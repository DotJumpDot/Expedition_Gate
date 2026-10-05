import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCampaign, heroFromProposal, listCampaigns } from '$lib/server/engine/campaigns';
import { type HeroProposal } from '$lib/server/engine/gm';
import { WorldBriefSchema, type WorldBrief } from '$lib/server/engine/worldstate';

/** GET /api/campaigns — the Gate screen's campaign list (open campaigns only). */
export const GET: RequestHandler = () => {
	return json({ campaigns: listCampaigns() }, { headers: { 'cache-control': 'no-store' } });
};

/**
 * POST /api/campaigns — create the campaign after the wizard: the player has
 * accepted a world brief + hero proposal (identity + AI stats + kit).
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		setting?: string;
		tone?: string[];
		brief?: unknown;
		heroName?: string;
		heroConcept?: string;
		heroClass?: string;
		proposal?: unknown;
	};

	const brief = WorldBriefSchema.safeParse(body.brief);
	if (!brief.success) {
		return json({ error: 'world brief ไม่ถูกต้อง' }, { status: 400 });
	}
	if (!body.proposal || !body.heroName?.trim()) {
		return json({ error: 'ต้องมีชื่อฮีโร่และค่าสถานะที่ยอมรับแล้ว' }, { status: 400 });
	}

	// Re-validate the proposal the client sends back (never trust the browser).
	const { HeroProposalSchema } = await import('$lib/server/engine/gm');
	const proposal: HeroProposal = HeroProposalSchema.parse(body.proposal);

	const id = createCampaign({
		brief: brief.data as WorldBrief,
		hero: heroFromProposal(
			{
				name: body.heroName.trim(),
				concept: body.heroConcept?.trim() ?? '',
				klass: body.heroClass?.trim() || 'นักผจญภัย'
			},
			proposal
		),
		setting: body.setting ?? 'custom',
		tone: body.tone ?? []
	});

	return json({ id }, { status: 201 });
};
