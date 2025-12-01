import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import AdminScheduler from "./AdminScheduler";
import LoginPage from "./LoginPage";

type Props = {
  supabaseUrl: string;
  supabaseKey: string;
};

function AdminAuth({ supabaseUrl, supabaseKey }: Props) {
  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseKey),
    [supabaseKey, supabaseUrl],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session ?? null);
      setCheckingSession(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setAuthError(null);
        setCheckingSession(false);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogin = async (email: string, password: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setAuthError(error.message);
    setIsSigningIn(false);
  };

  const handleLogout = async () => {
    setAuthError(null);
    await supabase.auth.signOut();
  };

  if (checkingSession) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-3 px-4 py-10">
        <p className="text-sm text-ink-600">Checking admin session…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <LoginPage
        onSubmit={handleLogin}
        loading={isSigningIn}
        error={authError}
      />
    );
  }

  return (
    <AdminScheduler
      configStatus="ready"
      authToken={session.access_token}
      userEmail={session.user.email ?? "Admin"}
      onSignOut={handleLogout}
    />
  );
}

export default AdminAuth;
