import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ManifestEntry {
	file: string;
	bucket: string;
	tags: string[];
	settings?: string[];
	source?: string;
	license?: string;
	author?: string;
}

/** GET /api/portraits — the committed portrait catalog, flagged by availability. */
export const GET: RequestHandler = () => {
	try {
		const raw = JSON.parse(readFileSync(resolve('assets/portraits.json'), 'utf8')) as {
			portraits?: ManifestEntry[];
		};
		const portraits = (raw.portraits ?? []).map((entry) => ({
			file: entry.file,
			bucket: entry.bucket,
			tags: entry.tags ?? [],
			source: entry.source ?? '',
			license: entry.license ?? '',
			author: entry.author ?? '',
			url: `/assets/portraits/${entry.file}`,
			available: existsSync(resolve('static/assets/portraits', entry.file))
		}));
		return json({ portraits }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		// Fresh clone before generation — empty catalog, never a 500.
		return json({ portraits: [] }, { headers: { 'cache-control': 'no-store' } });
	}
};
