import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateWorldBrief, SETTING_PRESETS, type SettingKey } from '$lib/server/engine/gm';

/**
 * POST /api/campaigns/brief — wizard step 1: generate a world brief preview.
 * The 🎲 button simply calls this again (fresh roll).
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		setting?: string;
		tone?: string[];
		premise?: string;
	};

	const setting = (body.setting ?? 'sword_sorcery') as SettingKey;
	if (!(setting in SETTING_PRESETS)) {
		return json({ error: 'ฉากไม่ถูกต้อง' }, { status: 400 });
	}

	const result = await generateWorldBrief({
		setting,
		tone: Array.isArray(body.tone) ? body.tone.slice(0, 4) : [],
		premise: body.premise?.slice(0, 400)
	});

	if (!result.ok) {
		return json({ error: `สร้างโลกไม่สำเร็จ (${result.error})` }, { status: 502 });
	}
	return json({ brief: result.brief }, { headers: { 'cache-control': 'no-store' } });
};
