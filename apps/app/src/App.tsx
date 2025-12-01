import { useEffect, useState } from "react";
import AdminGate from "./components/AdminGate";
import ConfigState from "./components/ConfigState";
import ParticipantView from "./components/participant/ParticipantView";
import {
  API_BASE,
  INITIAL_SUPABASE_ANON_KEY,
  INITIAL_SUPABASE_URL,
} from "./constants";
import type { SupabaseConfigState } from "./types/config";
import { randomHex } from "./utils/random";

export default function App() {
  const search = new URLSearchParams(window.location.search);
  const sessionId = search.get("sessionId");
  const token = search.get("token") ?? randomHex();
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfigState>(
    () => ({
      url: INITIAL_SUPABASE_URL,
      anonKey: INITIAL_SUPABASE_ANON_KEY,
      status:
        INITIAL_SUPABASE_URL && INITIAL_SUPABASE_ANON_KEY
          ? ("ready" as const)
          : ("loading" as const),
      error: "",
    }),
  );

  useEffect(() => {
    if (supabaseConfig.status !== "loading") return;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/public-config`);
        const data = await response.json();
        if (!response.ok || !data.supabaseUrl || !data.supabaseAnonKey) {
          setSupabaseConfig((prev) => ({
            ...prev,
            status: "error",
            error: "Supabase config not available",
          }));
          return;
        }
        setSupabaseConfig({
          url: data.supabaseUrl,
          anonKey: data.supabaseAnonKey,
          status: "ready",
          error: "",
        });
      } catch (error) {
        console.error("Failed to load public config", error);
        setSupabaseConfig((prev) => ({
          ...prev,
          status: "error",
          error: "Unable to load Supabase config",
        }));
      }
    })();
  }, [supabaseConfig.status]);

  const needsConfig = supabaseConfig.status !== "ready";

  if (sessionId) {
    if (needsConfig) {
      return (
        <ConfigState
          status={supabaseConfig.status}
          error={supabaseConfig.error}
        />
      );
    }
    return (
      <ParticipantView
        sessionId={sessionId}
        token={token}
        supabaseUrl={supabaseConfig.url}
        supabaseKey={supabaseConfig.anonKey}
      />
    );
  }

  return <AdminGate supabaseConfig={supabaseConfig} />;
}
