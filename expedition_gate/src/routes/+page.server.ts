import type { PageServerLoad } from './$types';
import { listCampaigns } from '$lib/server/engine/campaigns';

export const load: PageServerLoad = async () => {
	return { campaigns: listCampaigns() };
};
