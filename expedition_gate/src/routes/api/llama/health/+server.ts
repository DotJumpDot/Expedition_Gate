import { json } from '@sveltejs/kit';
import { health } from '$lib/server/llama';

export const GET = async () => {
	const result = await health();
	return json(result, {
		headers: { 'cache-control': 'no-store' }
	});
};
