/**
 * Hero-portrait selection (Docs/02 § Hero portraits) — ISOMORPHIC: imported by
 * client components and tests, free of node imports.
 *
 * The library is ANIME-ONLY (a photorealistic bucket was generated 2026-10-06
 * and dropped by user review — it didn't match the app's fantasy look). Entries
 * keep a `bucket` field so a future style expansion stays schema-compatible.
 */

export const PORTRAIT_BUCKET = 'anime';

export const PORTRAIT_ROLES = [
	'poor',
	'commoner',
	'merchant',
	'warrior',
	'mystic',
	'noble'
] as const;
export type PortraitRole = (typeof PORTRAIT_ROLES)[number];

export interface PortraitEntry {
	file: string;
	bucket: string;
	/** [age, role] from the fixed vocabularies (assets/portraits.json). */
	tags: string[];
	url?: string;
	available?: boolean;
	/** Attribution, as served by /api/portraits from the catalog. */
	source?: string;
	license?: string;
	author?: string;
}

/**
 * Thai class string → portrait role tag. Substring match, lowercase,
 * first mapping row that hits wins, anything else is a commoner.
 */
export function roleTagForClass(klass: string): PortraitRole {
	const text = klass.toLowerCase();
	const rows: Array<[RegExp, PortraitRole]> = [
		[/นักเวท|หมอผี|นักบวช|นักปราชญ์|เวท|mage|wizard|priest/, 'mystic'],
		[/นักดาบ|อัศวิน|นักล่า|นักธนู|ทหาร|ดาบ|knight|sword|hunter|archer/, 'warrior'],
		[/พ่อค้า|ค้าขาย|merchant|trader/, 'merchant'],
		[/กษัตริย์|ราชา|ราชินี|เจ้าคุณ|ขุนนาง|เจ้าเมือง|noble|king|queen/, 'noble'],
		[/โจร|ขโมย|thief|rogue/, 'poor']
	];
	for (const [pattern, role] of rows) {
		if (pattern.test(text)) return role;
	}
	return 'commoner';
}

/** FNV-1a — the same stable hash the asset scripts use. */
function hashKey(key: string): number {
	let h = 2166136261;
	for (const ch of key) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
	return h >>> 0;
}

/**
 * Deterministic pick: keep available library entries, prefer those whose tags
 * include the class's role, tie-break by stable hash of seedKey (hero name) so
 * the same hero keeps the same face across reloads. Empty library → null.
 */
export function pickPortrait(
	entries: PortraitEntry[],
	klass: string,
	seedKey: string
): PortraitEntry | null {
	const usable = entries.filter(
		(entry) => entry.bucket === PORTRAIT_BUCKET && entry.available !== false
	);
	if (usable.length === 0) return null;
	const role = roleTagForClass(klass);
	const preferred = usable.filter((entry) => entry.tags.includes(role));
	const pool = preferred.length > 0 ? preferred : usable;
	return pool[hashKey(seedKey) % pool.length] ?? null;
}
