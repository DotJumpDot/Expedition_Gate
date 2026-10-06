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
	/** Group vocabulary: heroes [age, role], personality variants [gender, role,
	 *  expression], professions [gender, profession], monsters ['monster', name]. */
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

// --- NPC & monster faces -----------------------------------------------------
// The GM adds NPCs (and enemies) as world-state entries with free-text Thai
// names/roles; these keyword tables route them at the library's profession,
// monster, and personality-variant groups. Best effort by design — any miss
// falls through to a sensible pool, never to "no portrait".

const MONSTER_KEYWORDS: Array<[string, string[]]> = [
	['goblin', ['กอบลิน', 'โกบลิน', 'goblin']],
	['orc', ['ออร์ก', 'ออร์ค', 'orc']],
	['slime', ['สไลม์', 'slime']],
	['dragon', ['มังกร', 'dragon', 'ไวเวิร์น', 'wyvern']],
	['skeleton', ['โครงกระดูก', 'skeleton']],
	['ghost', ['ผี', 'วิญญาณ', 'ภูต', 'ghost']],
	['wolf', ['หมาป่า', 'wolf']],
	['bandit', ['โจร', 'ปล้น', 'bandit']],
	['troll', ['ยักษ์', 'troll']],
	['kobold', ['โคบอลด์', 'kobold']],
	['golem', ['กอเลม', 'โกเลม', 'จักรกลเวท', 'golem']],
	['harpy', ['ฮาร์ปี้', 'ฮาร์ปี', 'harpy']]
];

const PROFESSION_KEYWORDS: Array<[string, string[]]> = [
	['innkeeper', ['โรงแรม', 'โรงเหล้า', 'เฝ้าโรง', 'แม่เม้า', 'เจ้าของร้านเหล้า', 'ที่พัก']],
	['guard', ['ยาม', 'ผู้พิทักษ์', 'องครักษ์', 'เจ้าหน้าที่', 'ฝ่ายธุรการ']],
	['blacksmith', ['ช่างตีเหล็ก', 'ช่างเหล็ก', 'ตีเหล็ก', 'ช่างซ่อม']],
	['servant', ['สาวใช้', 'คนรับใช้', 'บ่าว', 'ข้ารับใช้', 'สมุบ']],
	['farmer', ['ชาวนา', 'ชาวไร่', 'เกษตรกร']],
	['priest', ['พระ', 'นักบวช', 'หมอผี', 'ปุโรหิต', 'แม่ชี', 'เณร']]
];

const WOMAN_HINTS = ['ป้า', 'ยาย', 'แม่', 'นาง', 'หญิง', 'สาว', 'คุณหญิง', 'หม่อม'];
const MAN_HINTS = ['ลุง', 'ตา', 'พ่อ', 'นาย', 'ชาย', 'หนุ่ม'];
const ADULT_AGES = ['man', 'woman', 'grandpa', 'grandma'];

function firstHit(haystack: string, table: Array<[string, string[]]>): string | null {
	for (const [tag, words] of table) {
		if (words.some((word) => haystack.includes(word))) return tag;
	}
	return null;
}

/**
 * Portrait for a world-state NPC (or enemy — monsters route via name/role
 * keywords). Fallback chain: monster → profession/role (± gender) → any adult
 * → anything; tie-break stable per NPC name. Empty library → null.
 */
export function pickNpcPortrait(
	entries: PortraitEntry[],
	npcName: string,
	npcRole: string
): PortraitEntry | null {
	const usable = entries.filter(
		(entry) => entry.bucket === PORTRAIT_BUCKET && entry.available !== false
	);
	if (usable.length === 0) return null;

	const hay = `${npcName} ${npcRole}`.toLowerCase();

	// 1) monsters (the name or role names a creature)
	const monster = firstHit(hay, MONSTER_KEYWORDS);
	if (monster) {
		let pool = usable.filter((entry) => entry.tags[0] === 'monster' && entry.tags[1] === monster);
		if (pool.length > 0) return pool[hashKey(npcName) % pool.length] ?? null;
		pool = usable.filter((entry) => entry.tags[0] === 'monster');
		if (pool.length > 0) return pool[hashKey(npcName) % pool.length] ?? null;
	}

	// 2) profession (library professions first, then the hero-role vocabulary)
	const profTag = firstHit(hay, PROFESSION_KEYWORDS) ?? roleTagForClass(npcRole);
	const isWoman = WOMAN_HINTS.some((word) => hay.includes(word));
	const isMan = MAN_HINTS.some((word) => hay.includes(word));
	const gender = isWoman && !isMan ? 'woman' : isMan && !isWoman ? 'man' : null;
	let pool = usable.filter(
		(entry) =>
			entry.tags[0] !== 'monster' &&
			entry.tags.includes(profTag) &&
			(gender === null || entry.tags.includes(gender))
	);
	if (pool.length > 0) return pool[hashKey(npcName) % pool.length] ?? null;
	pool = usable.filter((entry) => entry.tags[0] !== 'monster' && entry.tags.includes(profTag));
	if (pool.length > 0) return pool[hashKey(npcName) % pool.length] ?? null;

	// 3) any adult human (kids read wrong for arbitrary NPCs)
	pool = usable.filter(
		(entry) => entry.tags[0] !== 'monster' && ADULT_AGES.includes(entry.tags[0])
	);
	if (pool.length > 0) return pool[hashKey(npcName) % pool.length] ?? null;
	return usable[hashKey(npcName) % usable.length] ?? null;
}
