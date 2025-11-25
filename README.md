# Found Poems Monorepo

This repository will host a unified workspace for the Found Poems platform. We are standing up three coordinated projects:

- `server`: A Node.js + Express API for real-time poem generation, persistence, and authentication workflows.
- `app`: The primary interactive React app (think authoring console) styled with Tailwind CSS.
- `site`: A complementary marketing/documentation React site sharing the same Tailwind design system.

The monorepo approach keeps shared config (TypeScript, ESLint, Tailwind presets, CI) in one place, streamlines dependency upgrades, and allows us to share UI packages or utilities across surfaces.

## Stack Decisions

| Concern | Choice | Notes |
| --- | --- | --- |
| Package / build | `pnpm` workspaces + Turborepo | Fast installs, deterministic lockfile, and task pipelining across packages. |
| UI runtime | React 18 + Vite | Vite keeps local DX snappy while letting us share TS + Tailwind configs. |
| Styling | Tailwind CSS + shared preset | Ensures identical tokens across `app` and `site`; extracted to `packages/tailwind-config`. |
| API | Express 5 + TypeScript | Minimal surface, easy middleware ecosystem, deployable on any Node target. |
| Auth | Lucia + session cookies | Lucia plays nicely with Express and React, keeps vendor lock-in low, and stores sessions in our DB. |
| Database | Supabase Postgres (via Prisma) | Managed Postgres with branching + SQL access; Prisma for schema + type safety. |
| Realtime + Auth | Supabase Realtime + GoTrue | Hosted WebSocket layer for blackout events plus email magic-link auth. |
| Persistence | Supabase storage + Postgres | Use Supabase project for prod/staging; local dev via Supabase CLI docker stack. |

## Repository Layout

```
found-poems/
├─ apps/
│  ├─ app/      # React authoring interface (Vite, Tailwind)
│  └─ site/     # Marketing/docs site (Vite, Tailwind)
├─ packages/
│  ├─ ui/       # Reusable React components + Tailwind primitives
│  ├─ tailwind-config/
│  └─ tsconfig/ # Shared TS base configs
└─ services/
   └─ server/   # Express API proxy + Supabase client helpers (CRON, publishing)
```

Additional shared packages (e.g., `eslint-config`, `lib-poetry`) can be added under `packages/` as the product matures.

## Development Workflow

1. Install dependencies: `pnpm install`
2. Start everything locally with Turborepo: `pnpm dev` (runs server, app, site in parallel)
3. Environment:
   - Copy `.env.example` ➜ `.env` at repo root (values mirror Supabase project settings).
   - Required vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.
   - Local stack comes from Supabase CLI (`pnpm supabase:start`) which boots Postgres, Realtime, and Studio using `supabase/config.toml`.
4. Database:
   - Prisma migrations live in `services/server/prisma`.
   - Run `pnpm db:migrate` after schema changes.
5. Auth + Realtime:
   - Supabase GoTrue handles email-based invites + magic links.
   - Supabase Realtime channels broadcast word blackout events.
   - React apps use Supabase JS client + shared hooks in `packages/ui`.
   - Local testing uses the Supabase CLI stack + the generated Prisma migrations (`pnpm db:migrate`).

## Supabase Architecture

- **Project layout**: One Supabase project (paused others to unlock quota) hosts Postgres, GoTrue auth, Realtime, Storage, and Edge Functions.
- **Data model**:
  - `sessions`: scheduled collaboration windows with state (`scheduled`, `active`, `closed`, `ready`).
  - `session_invites`: email, token, role, attendance.
  - `source_texts`: cached corpus references.
  - `words`: denormalized entries (session_id, index, text, hidden boolean, actor metadata).
  - `poems`: final published artifact once admin marks session ready.
- **Realtime**: Clients subscribe to `realtime:words:session_id` (filtered via RLS). A blackout click writes via RPC or direct row update; Realtime pushes the change (<150 ms) to all connected editors.
- **Auth**: Invitations issue Supabase magic links scoped to a session. Lobby pages verify session + token, then rely on Supabase session cookies for subsequent API calls.
- **Server role**: `services/server` remains a Node/Express worker (deployable off Vercel if needed) responsible for scheduled transitions (cron hitting Supabase Edge Function), advanced admin workflows, and bridging to third-party services. It talks to Supabase via service role keys and Prisma (Data Proxy) for type-safe migrations.
- **Local dev**: Use `supabase start` (Docker) to boot Postgres/Realtime/Auth locally. `.env` expects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Migrations**: Generated through Prisma and committed under `services/server/prisma/migrations`. Apply them locally with `pnpm db:migrate` while the Supabase stack is running.

## Running Supabase Locally

1. Install the Supabase CLI (`brew install supabase/tap/supabase` or see docs).
2. Start the stack: `pnpm supabase:start` (reads `supabase/config.toml`; exposes Postgres on `localhost:54322`).
3. Copy `.env.example` ➜ `.env` and point `SUPABASE_URL`/keys to either the hosted project or the local instance (CLI prints the anon + service keys on boot).
4. Run database migrations while the local stack is up: `pnpm db:migrate`.
5. When finished, `pnpm supabase:stop`. Check status anytime with `pnpm supabase:status`.

## Development Setup

1. **Install toolchain**
   - Node 18.20+ (or enable Corepack) and pnpm 9+ (`pnpm env use --global lts` also works).
   - Turborepo/biome are installed as devDependencies; no global install required.
   - Docker runtime via Colima or Docker Desktop (needed for Supabase CLI). If using Colima, run `colima start` before Supabase commands.
2. **Install dependencies**: `pnpm install` (installs root + workspace packages).
3. **Environment**: copy `.env.example` ➜ `.env`, fill in Supabase keys or use the local stack defaults printed by `pnpm supabase:start`.
4. **Local services**:
   - `pnpm supabase:start` boots Postgres, GoTrue, Realtime, storage, etc. (`-x vector` flag is baked into the script to avoid Docker socket mounting that Colima blocks).
   - `pnpm db:migrate` applies Prisma migrations to the running Supabase Postgres instance.
5. **Apps + server**: run `pnpm dev` to launch Express (`services/server`), the studio app (`apps/app`), and the marketing site (`apps/site`) in parallel via Turborepo.
6. **Other scripts**:
   - `pnpm build` – run builds for all workspaces.
   - `pnpm lint` – Biome across packages.
   - `pnpm format` – repository-wide formatting.
   - `pnpm supabase:stop` / `pnpm supabase:status` – manage the local Supabase stack.

## Next Steps

- Scaffold the workspace (`pnpm init`, Turborepo config, shared tsconfig/tailwind packages).
- Implement the Express server focused on Supabase orchestration (session scheduling, admin APIs) and expose typed client SDKs.
- Bootstrap both React apps with Vite + Tailwind, wiring shared UI + env loading.
- Add CI (GitHub Actions) for lint/test/build per package and database migrations.

This README will evolve as we add concrete code, but it captures the architectural intent so contributors can align before we start scaffolding.
