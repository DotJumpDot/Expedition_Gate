import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCheckpoint, getCampaign, listCheckpoints } from '$lib/server/engine/campaigns';

/** GET — list checkpoints (newest first). */
export const GET: RequestHandler = async ({ params }) => {
	if (!getCampaign(params.id)) return json({ error: 'ไม่พบการผจญภัย' }, { status: 404 });
	return json(
		{ checkpoints: listCheckpoints(params.id) },
		{ headers: { 'cache-control': 'no-store' } }
	);
};

/** POST — save a manual checkpoint with a note. */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!getCampaign(params.id)) return json({ error: 'ไม่พบการผจญภัย' }, { status: 404 });
	const body = (await request.json().catch(() => ({}))) as { note?: string };
	const created = createCheckpoint(params.id, body.note ?? '');
	if (!created) return json({ error: 'บันทึกไม่สำเร็จ' }, { status: 500 });
	return json({ ok: true }, { status: 201 });
};
