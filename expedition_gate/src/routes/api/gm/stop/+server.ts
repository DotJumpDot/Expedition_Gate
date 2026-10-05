import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stopTurn } from '$lib/server/engine/turnRuntime';

/** POST /api/gm/stop — abort the in-flight GM turn for a campaign. */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { campaignId?: string };
	const campaignId = body.campaignId ?? '';
	if (!campaignId) return json({ error: 'ไม่มี campaignId' }, { status: 400 });

	const stopped = stopTurn(campaignId);
	return json({ ok: true, stopped });
};
