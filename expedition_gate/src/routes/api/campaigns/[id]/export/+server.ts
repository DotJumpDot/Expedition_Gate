import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportCampaign } from '$lib/server/engine/campaigns';

/** GET — download the whole campaign as one .json file. */
export const GET: RequestHandler = async ({ params }) => {
	const data = exportCampaign(params.id);
	if (!data) return json({ error: 'ไม่พบการผจญภัย' }, { status: 404 });
	const filename = `gate-${params.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
	return new Response(JSON.stringify(data, null, '\t'), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': 'no-store'
		}
	});
};
