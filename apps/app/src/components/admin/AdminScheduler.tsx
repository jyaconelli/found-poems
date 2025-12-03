import { Button } from "@found-poems/ui";
import { NavLink, Outlet } from "react-router-dom";

type Props = {
  configStatus: "loading" | "ready" | "error";
  authToken: string;
  userEmail: string;
  onSignOut: () => void;
};

export type AdminOutletContext = { authToken: string };

function AdminScheduler({
  configStatus,
  authToken,
  userEmail,
  onSignOut,
}: Props) {
  const navClasses = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 transition ${
      isActive ? "bg-ink-900 text-white shadow-sm" : "hover:bg-white"
    }`;
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500">
            Signed in
          </p>
          <p className="text-sm font-semibold text-ink-900">{userEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
      {configStatus !== "ready" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase config is {configStatus}. Invites will still work, but
          presence requires the public config endpoint.
        </div>
      )}
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-ink-500">
          Admin Console
        </p>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-base text-ink-600">
          Manage collaboration sessions and publish completed poems.
        </p>
      </header>

      <div className="flex gap-2 rounded-full bg-ink-50 p-1 text-sm font-semibold text-ink-700">
        <NavLink to="/admin/sessions" className={navClasses}>
          Sessions
        </NavLink>
        <NavLink to="/admin/rss-streams" className={navClasses}>
          RSS Poem Streams
        </NavLink>
      </div>

      <Outlet context={{ authToken }} />
    </main>
  );
}

export default AdminScheduler;
