import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restoreCheckpoint } from '$lib/server/engine/campaigns';

/**
 * POST — restore a checkpoint. Auto-snapshots the current branch first, so
 * nothing is ever lost (the abandoned timeline becomes its own checkpoint).
 */
export const POST: RequestHandler = async ({ params }) => {
	const result = restoreCheckpoint(params.id, params.checkpointId);
	if (!result.ok) return json({ error: result.error }, { status: 400 });
	return json({ ok: true, state: result.state });
};
