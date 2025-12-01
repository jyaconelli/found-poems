import { SessionStatus } from "@prisma/client";
import { prisma } from "../clients/prisma";
import { config } from "../config";

export async function refreshSessionStatuses() {
	const now = new Date();

  console.log('[sessions] status refresh beginning')

	const [activated, closed] = await Promise.all([
		prisma.session.updateMany({
			where: {
				status: SessionStatus.scheduled,
				startsAt: { lte: now },
				endsAt: { gt: now },
			},
			data: { status: SessionStatus.active },
		}),
		prisma.session.updateMany({
			where: {
				status: { in: [SessionStatus.scheduled, SessionStatus.active] },
				endsAt: { lte: now },
			},
			data: { status: SessionStatus.closed },
		}),
	]);

	if (activated.count || closed.count) {
		console.log("[sessions] status refresh", {
			now: now.toISOString(),
			activated: activated.count,
			closed: closed.count,
		});
	}
}

export function startStatusRefresh() {
	void refreshSessionStatuses();
	return setInterval(refreshSessionStatuses, config.statusRefreshIntervalMs);
}
