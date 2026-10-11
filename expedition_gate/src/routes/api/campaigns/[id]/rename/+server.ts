import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { renameCampaign } from '$lib/server/engine/campaigns';

/** POST /api/campaigns/[id]/rename — { title?, heroName? }, either or both. */
export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		title?: unknown;
		heroName?: unknown;
	};
	const result = renameCampaign(params.id, body);
	return json(result, { status: result.ok ? 200 : 400 });
};
