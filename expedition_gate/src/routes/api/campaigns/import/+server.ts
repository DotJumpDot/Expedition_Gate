import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importCampaign, type CampaignExport } from '$lib/server/engine/campaigns';

/** Sanity cap for imported files — a real export is far below this. */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/** POST — import a campaign export (.json); returns the new campaign id. */
export const POST: RequestHandler = async ({ request }) => {
	const declaredSize = Number(request.headers.get('content-length') ?? 0);
	if (declaredSize > MAX_IMPORT_BYTES) {
		return json({ error: 'ไฟล์ใหญ่เกินขีดจำกัด' }, { status: 413 });
	}
	let payload: CampaignExport;
	try {
		const raw = await request.text();
		if (raw.length > MAX_IMPORT_BYTES) {
			return json({ error: 'ไฟล์ใหญ่เกินขีดจำกัด' }, { status: 413 });
		}
		payload = JSON.parse(raw) as CampaignExport;
	} catch {
		return json({ error: 'ไฟล์ไม่ใช่ JSON ที่ถูกต้อง' }, { status: 400 });
	}
	const id = importCampaign(payload);
	if (!id)
		return json(
			{ error: 'ไฟล์นี้ไม่ใช่ไฟล์ส่งออกของประตูนักสำรวจ (หรือเสียหาย)' },
			{ status: 400 }
		);
	return json({ id }, { status: 201 });
};
