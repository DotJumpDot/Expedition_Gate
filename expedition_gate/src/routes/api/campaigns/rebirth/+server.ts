import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rebirthCampaign } from '$lib/server/engine/campaigns';
import { HeroProposalSchema } from '$lib/server/engine/gm';

/**
 * POST /api/campaigns/rebirth — ประตูบานใหม่: create a new campaign for a new
 * hero in the SAME world (brief + chronicle + world state carry over).
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		campaignId?: string;
		heroName?: string;
		heroConcept?: string;
		heroClass?: string;
		proposal?: unknown;
	};

	if (!body.campaignId || !body.heroName?.trim() || !body.proposal) {
		return json({ error: 'ต้องมีชื่อฮีโร่ใหม่และค่าสถานะ' }, { status: 400 });
	}

	const proposal = HeroProposalSchema.safeParse(body.proposal);
	if (!proposal.success) {
		return json({ error: 'ค่าสถานะไม่ถูกต้อง' }, { status: 400 });
	}

	const id = rebirthCampaign({
		campaignId: body.campaignId,
		heroName: body.heroName,
		heroConcept: body.heroConcept ?? '',
		heroClass: body.heroClass ?? 'นักผจญภัย',
		proposal: proposal.data
	});
	if (!id) return json({ error: 'สร้างโลกใหม่ไม่สำเร็จ' }, { status: 500 });

	return json({ id }, { status: 201 });
};
