import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCampaign } from '$lib/server/engine/campaigns';

export const load: PageServerLoad = async ({ params }) => {
	const row = getCampaign(params.id);
	if (!row) redirect(302, '/');
	// Ended campaigns stay viewable (read-only) for the epilogue + ประตูบานใหม่ flow;
	// the turn API refuses them.
	return { id: row.id, title: row.title, ended: row.ended };
};
