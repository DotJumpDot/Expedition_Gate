import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getCampaign,
	getLastGmMessage,
	parseState,
	setMessageMeta
} from '$lib/server/engine/campaigns';
import { generateSuggestions } from '$lib/server/engine/gm';

/**
 * POST /api/gm/suggestions — choice chips for the latest GM turn.
 * Cached on the message meta (sugCache); N is sliced client-side from the
 * cached pool so the setting can change without re-calling the model.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { campaignId?: string; n?: number };
	const campaignId = body.campaignId ?? '';
	if (!campaignId) return json({ error: 'ไม่มี campaignId' }, { status: 400 });

	const row = getCampaign(campaignId);
	if (!row) return json({ error: 'ไม่พบการผจญภัย' }, { status: 404 });

	const lastGm = getLastGmMessage(campaignId);
	if (!lastGm) return json({ chips: [] });

	const meta = (lastGm.meta as Record<string, unknown> | null) ?? {};
	const cached = Array.isArray(meta.sugCache) ? (meta.sugCache as string[]) : null;
	if (cached && cached.length > 0) {
		return json({ chips: cached });
	}

	const state = parseState(row.stateJson);
	if (!state) return json({ error: 'สถานะเสียหาย' }, { status: 500 });

	const result = await generateSuggestions({
		narration: lastGm.content,
		quickFacts: `วันที่ ${state.world.day} (${state.world.timeOfDay}) · ${state.world.location}`,
		n: 6 // generate the max pool; the client slices to the user's setting
	});

	if (!result.ok) return json({ chips: [] });
	setMessageMeta(lastGm.id, { ...meta, sugCache: result.chips });
	return json({ chips: result.chips });
};
