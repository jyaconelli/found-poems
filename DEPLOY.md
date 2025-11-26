# Deploying Found Poems

This repo deploys three artifacts:
- `apps/site` → Vercel (public marketing/docs)
- `apps/app` → Vercel (authoring console)
- `services/server` → Heroku (API)

Prereqs: pnpm 9.x, Node 22.x, a Supabase project with `SUPABASE_URL`, anon + service keys, and JWT secret. Copy `.env.example` when you need a reference for required variables.

## Vercel – apps/site

One-time project setup
1) In Vercel, **New Project → Import** this repo.
2) Leave **Root Directory** empty (repo root). Build settings:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm --filter @found-poems/site build`
   - Output: `apps/site/dist`
   - (If Vercel complains about TypeScript include paths, ensure the repo has the latest tsconfig fixes and redeploy.)
   - Framework preset: Vite.
3) Environment Variables (Production/Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SERVER_URL` → your deployed API origin (Heroku URL)
   - `INVITE_BASE_URL` → public URL of this site (used in invites)
4) Save & Deploy to trigger the first build.

Ship new versions
- Push to the tracked branch (e.g., `main`) or click **Redeploy** in Vercel after env changes.

## Vercel – apps/app

One-time project setup
1) Create a second Vercel project from the same repo.
2) Same build settings as above:
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm --filter @found-poems/app build`
   - Output: `apps/app/dist`
   - Framework preset: Vite; Root Directory left empty.
3) Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SERVER_URL` → Heroku API URL
   - `INVITE_BASE_URL` → public URL of this app (used in invitation links)
4) Deploy once to verify.

Ship new versions
- Push to the tracked branch or redeploy from the Vercel dashboard after changing env/config.

## Heroku – services/server

One-time project setup
1) Install Heroku CLI and log in: `heroku login`.
2) Create the app: `heroku create found-poems-server` (or choose a name).
3) Add Node buildpack (default for Node repos): `heroku buildpacks:set heroku/nodejs`.
4) Ensure pnpm + devDeps are available during build:
   ```bash
   heroku config:set PNPM_VERSION=9.12.2 NODE_VERSION=22.21.0 NPM_CONFIG_PRODUCTION=false
   ```
5) Add a Procfile at repo root (commit this to the repo):
   ```Procfile
   release: pnpm --filter services-server exec prisma migrate deploy && pnpm --filter services-server exec prisma generate
   web: pnpm --filter services-server start
   ```
6) Set required config vars (use Supabase values):
   ```bash
   heroku config:set \
     SUPABASE_URL=... \
     SUPABASE_ANON_KEY=... \
     SUPABASE_SERVICE_ROLE_KEY=... \
     SUPABASE_JWT_SECRET=... \
     DATABASE_URL=postgresql://<user>:<password>@<host>:5432/postgres \
     SESSION_SECRET=... \
     ADMIN_EMAILS=comma-separated-admins \
     INVITE_BASE_URL=https://your-app-domain \
     RESEND_API_KEY=... \
     INVITE_EMAIL_FROM="Found Poems <team@yourdomain>"
   ```
7) (Optional) Set a custom process port: Heroku injects `PORT`; no action needed unless overriding.

First deploy
1) Push to Heroku: `git push heroku main` (or `heroku git:remote -a found-poems-server` first if needed).
2) Heroku runs `pnpm install`, `pnpm build` (turbo builds everything), then the `release` phase runs Prisma migrate + generate.
3) The dyno boots with `web` command. Verify health: `heroku open /api/health` or `heroku logs --tail`.

Ship new versions
- Push to the tracked branch; release phase re-applies migrations and regenerates Prisma client. Update env vars via `heroku config:set` and redeploy if needed.

## Quick Verification After Any Deploy
- API: GET `<HEROKU_URL>/api/health` returns `{ ok: true, database: true }`.
- App/Site: In browser console, `fetch('<HEROKU_URL>/api/poems')` should return an array.
- Admin path: issue a JWT signed with `SUPABASE_JWT_SECRET` containing an email in `ADMIN_EMAILS`, then `POST /api/sessions` should succeed.
