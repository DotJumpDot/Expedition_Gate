/**
 * In-flight turn registry — backs /api/gm/stop. One live GM turn per campaign;
 * stop = set the flag AND abort the upstream call (both, Windows lesson).
 */
const inflight = new Map<string, { aborted: boolean; controller: AbortController }>();

export function registerTurn(campaignId: string): {
	aborted: boolean;
	controller: AbortController;
} {
	const entry = { aborted: false, controller: new AbortController() };
	inflight.set(campaignId, entry);
	return entry;
}

export function finishTurn(campaignId: string) {
	inflight.delete(campaignId);
}

export function stopTurn(campaignId: string): boolean {
	const entry = inflight.get(campaignId);
	if (!entry) return false;
	entry.aborted = true;
	entry.controller.abort();
	return true;
}

export function isTurnRunning(campaignId: string): boolean {
	return inflight.has(campaignId);
}
