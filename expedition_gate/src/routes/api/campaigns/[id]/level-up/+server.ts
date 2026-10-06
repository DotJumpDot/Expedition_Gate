import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { levelUpCampaign } from '$lib/server/engine/campaigns';
import type { Stats } from '$lib/server/engine/rules';

/** POST — spend 2 stat points and level up (app math only). */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		allocations?: Partial<Record<keyof Stats, number>>;
	};
	const result = levelUpCampaign(params.id, body.allocations ?? {});
	if (!result.ok) return json({ error: result.error }, { status: 400 });
	return json({ state: result.state });
};
