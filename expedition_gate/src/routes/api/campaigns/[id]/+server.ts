import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteCampaign,
	getCampaign,
	getMessages,
	parseBrief,
	parseState
} from '$lib/server/engine/campaigns';

/** GET /api/campaigns/[id] — full campaign for resume (meta + brief + state + messages). */
export const GET: RequestHandler = async ({ params }) => {
	const row = getCampaign(params.id);
	if (!row) return json({ error: 'ไม่พบการผจญภัยนี้' }, { status: 404 });

	const state = parseState(row.stateJson);
	if (!state) return json({ error: 'สถานะโลกเสียหาย' }, { status: 500 });

	return json(
		{
			campaign: {
				id: row.id,
				title: row.title,
				setting: row.setting,
				tone: JSON.parse(row.tone || '[]') as string[],
				brief: parseBrief(row.worldBrief),
				stateStale: row.stateStale,
				ended: row.ended,
				turnCount: row.turnCount,
				sessionSummary: row.sessionSummary
			},
			state,
			messages: getMessages(row.id).map((message) => ({
				id: message.id,
				seq: message.seq,
				role: message.role,
				content: message.content,
				meta: (message.meta as Record<string, unknown> | null) ?? {}
			}))
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};

/** DELETE /api/campaigns/[id] — removes campaign + messages + checkpoints (cascade). */
export const DELETE: RequestHandler = async ({ params }) => {
	deleteCampaign(params.id);
	return json({ ok: true });
};
