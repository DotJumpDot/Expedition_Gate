import type { Handle } from '@sveltejs/kit/hooks';
import { backupDbOnce } from '$lib/server/db/backup';

// Server start: snapshot the campaign DB (throttled — at most every 30 min).
void backupDbOnce();

export const handle: Handle = async ({ event, resolve }) => resolve(event);
