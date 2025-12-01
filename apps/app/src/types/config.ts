export type SupabaseConfigState = {
	url: string;
	anonKey: string;
	status: "loading" | "ready" | "error";
	error: string;
};
