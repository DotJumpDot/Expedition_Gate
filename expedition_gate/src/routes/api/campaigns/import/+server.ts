import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importCampaign, type CampaignExport } from '$lib/server/engine/campaigns';

/** POST — import a campaign export (.json); returns the new campaign id. */
export const POST: RequestHandler = async ({ request }) => {
	let payload: CampaignExport;
	try {
		payload = (await request.json()) as CampaignExport;
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
