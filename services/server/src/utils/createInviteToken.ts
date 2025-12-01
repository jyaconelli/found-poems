import { randomBytes } from "node:crypto";

export function createInviteToken() {
	return randomBytes(16).toString("hex");
}
