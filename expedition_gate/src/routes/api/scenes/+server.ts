import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ManifestEntry {
	file: string;
	tags: string[];
	setting: string[];
	source: string;
	license: string;
	author: string;
}

/** GET /api/scenes — the committed scene-art manifest, flagged by availability. */
export const GET: RequestHandler = () => {
	try {
		const raw = JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf8')) as {
			images?: ManifestEntry[];
		};
		const scenes = (raw.images ?? []).map((entry) => ({
			file: entry.file,
			tags: entry.tags ?? [],
			setting: entry.setting ?? ['any'],
			source: entry.source ?? '',
			license: entry.license ?? '',
			author: entry.author ?? '',
			url: `/assets/scenes/${entry.file}`,
			available: existsSync(resolve('static/assets/scenes', entry.file))
		}));
		return json({ scenes }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json({ scenes: [] }, { headers: { 'cache-control': 'no-store' } });
	}
};
