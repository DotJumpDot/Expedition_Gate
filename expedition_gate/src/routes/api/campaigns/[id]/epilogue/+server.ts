import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	appendMessage,
	getCampaign,
	getMessages,
	parseState,
	parseBrief
} from '$lib/server/engine/campaigns';
import { generateEpilogue } from '$lib/server/engine/gm';
import { getDb } from '$lib/server/db/client';
import { campaigns } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST — the hero died: generate the campaign's closing narration, save it as
 * the final GM message, and mark the campaign ended='epilogue' (ready for
 * ประตูบานใหม่ — a new hero in the same world).
 */
export const POST: RequestHandler = async ({ params }) => {
	const row = getCampaign(params.id);
	if (!row) return json({ error: 'ไม่พบการผจญภัย' }, { status: 404 });
	if (row.ended !== 'dead') {
		return json({ error: 'ฮีโร่ยังไม่ได้เสียชีวิต (หรือจบเรื่องไปแล้ว)' }, { status: 409 });
	}

	const state = parseState(row.stateJson);
	const brief = parseBrief(row.worldBrief);
	if (!state || !brief) return json({ error: 'สถานะเสียหาย' }, { status: 500 });

	const storySoFar = [
		row.chronicle,
		row.sessionSummary,
		...getMessages(params.id, 30).map(
			(message) => `${message.role === 'player' ? 'ผู้เล่น' : 'GM'}: ${message.content}`
		)
	]
		.filter(Boolean)
		.join('\n---\n');

	const result = await generateEpilogue({
		heroName: state.hero.name,
		heroClass: state.hero.klass,
		deathPlace: state.world.location,
		day: state.world.day,
		storySoFar
	});
	if (!result.ok)
		return json({ error: `เขียนบทส่งท้ายไม่สำเร็จ (${result.error})` }, { status: 502 });

	appendMessage({
		campaignId: params.id,
		role: 'gm',
		content: result.text,
		meta: { epilogue: true }
	});
	getDb()
		.update(campaigns)
		.set({ ended: 'epilogue', updatedAt: new Date() })
		.where(eq(campaigns.id, params.id))
		.run();

	return json({ epilogue: result.text });
};
