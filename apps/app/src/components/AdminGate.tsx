import type { SupabaseConfigState } from "../types/config";
import AdminAuth from "./admin/AdminAuth";
import ConfigState from "./ConfigState";

type Props = {
	supabaseConfig: SupabaseConfigState;
};

function AdminGate({ supabaseConfig }: Props) {
	if (supabaseConfig.status !== "ready") {
		return (
			<ConfigState
				status={supabaseConfig.status}
				error={supabaseConfig.error}
			/>
		);
	}

	return (
		<AdminAuth
			supabaseUrl={supabaseConfig.url}
			supabaseKey={supabaseConfig.anonKey}
		/>
	);
}

export default AdminGate;
