import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateHeroProposal } from '$lib/server/engine/gm';
import { resolveLlamaBaseUrl } from '$lib/server/llama';
import { WorldBriefSchema } from '$lib/server/engine/worldstate';

/**
 * POST /api/campaigns/hero-proposal — wizard step 2: AI proposes stats + kit +
 * ปูมหลัง from the hero concept. The player tweaks or rerolls before accepting.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		brief?: unknown;
		name?: string;
		concept?: string;
		klass?: string;
		classNote?: string;
		baseUrl?: string;
	};

	const brief = WorldBriefSchema.safeParse(body.brief);
	if (!brief.success) {
		return json({ error: 'world brief ไม่ถูกต้อง' }, { status: 400 });
	}

	let baseUrl: string;
	try {
		baseUrl = resolveLlamaBaseUrl(body.baseUrl);
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : 'GM URL ไม่ถูกต้อง' },
			{ status: 400 }
		);
	}

	const result = await generateHeroProposal(
		{
			brief: brief.data,
			name: body.name?.slice(0, 40) ?? '',
			concept: body.concept?.slice(0, 300) ?? '',
			klass: body.klass?.slice(0, 40) || 'นักผจญภัย',
			classNote: body.classNote?.trim().slice(0, 300) || undefined
		},
		baseUrl
	);

	if (!result.ok) {
		return json({ error: `สร้างฮีโร่ไม่สำเร็จ (${result.error})` }, { status: 502 });
	}
	return json({ proposal: result.proposal }, { headers: { 'cache-control': 'no-store' } });
};
