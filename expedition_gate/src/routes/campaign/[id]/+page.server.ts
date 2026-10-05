import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCampaign } from '$lib/server/engine/campaigns';

export const load: PageServerLoad = async ({ params }) => {
	const row = getCampaign(params.id);
	if (!row || row.ended) redirect(302, '/');
	return { id: row.id, title: row.title };
};
