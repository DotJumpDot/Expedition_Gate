/**
 * Hero-portrait selection (Docs/02 § Hero portraits) — ISOMORPHIC: imported by
 * client components and tests, free of node imports.
 *
 * The library is ANIME-ONLY (a photorealistic bucket was generated 2026-10-06
 * and dropped by user review — it didn't match the app's fantasy look). Entries
 * keep a `bucket` field so a future style expansion stays schema-compatible.
 *
 * Faces are picked by the APP, never by the model: the GM only describes (NPC
 * name/role/portrait hint, hero concept), and Thai keyword tables here map that
 * text onto the library's groups — profession, monster, gender/age, and
 * temperament (cheerful/stern/dull). Every pick is deterministic per name.
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

export type PortraitExpression = 'cheerful' | 'stern' | 'dull';

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

/**
 * Thai appearance words → temperament variant (library expression group).
 * Reads the GM's portrait hint / hero concept: "ยิ้มแย้ม ร่าเริง" → cheerful,
 * "หน้านิ่ง จริงจัง" → stern, "เหนื่อยอ่อนเพลีย ซีด" → dull. null = no signal.
 */
export function expressionTagFor(text: string): PortraitExpression | null {
	const hay = text.toLowerCase();
	const rows: Array<[RegExp, PortraitExpression]> = [
		[/ยิ้ม|แย้ม|ร่าเริง|เบิกบาน|แจ่มใส|สดใส|รื่นเริง|เฮฮา|cheerful|smile/, 'cheerful'],
		[/นิ่ง|เคร่ง|จริงจัง|ขรึม|เย็นชา|ดุดัน|stern|serious/, 'stern'],
		[/เหนื่อย|อ่อนเพลีย|ซีด|ซึม|เฉยเมย|เหม่อ|อมทุกข์|weary|tired|dull/, 'dull']
	];
	for (const [pattern, expression] of rows) {
		if (pattern.test(hay)) return expression;
	}
	return null;
}

/** FNV-1a — the same stable hash the asset scripts use. */
function hashKey(key: string): number {
	let h = 2166136261;
	for (const ch of key) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
	return h >>> 0;
}

function pickFrom(pool: PortraitEntry[], seed: string): PortraitEntry | null {
	return pool[hashKey(seed) % pool.length] ?? null;
}

/** Prefer the temperament variant when the pool has one; never empty the pool. */
function preferExpression(
	pool: PortraitEntry[],
	expression: PortraitExpression | null
): PortraitEntry[] {
	if (!expression) return pool;
	const hit = pool.filter((entry) => entry.tags.includes(expression));
	return hit.length > 0 ? hit : pool;
}

/**
 * Deterministic hero pick: keep available library entries, prefer those whose
 * tags include the class's role, then narrow by the hero concept's temperament
 * ("หญิงสาวร่าเริง" → a cheerful face), tie-break by stable hash of seedKey
 * (hero name) so the same hero keeps the same face across reloads.
 * Empty library → null.
 */
export function pickPortrait(
	entries: PortraitEntry[],
	klass: string,
	seedKey: string,
	conceptHint = ''
): PortraitEntry | null {
	const usable = entries.filter(
		(entry) => entry.bucket === PORTRAIT_BUCKET && entry.available !== false
	);
	if (usable.length === 0) return null;
	const role = roleTagForClass(klass);
	const preferred = usable.filter((entry) => entry.tags.includes(role));
	let pool = preferred.length > 0 ? preferred : usable;
	pool = preferExpression(pool, expressionTagFor(conceptHint));
	return pickFrom(pool, seedKey);
}

// --- NPC & monster faces -----------------------------------------------------
// The GM adds NPCs (and enemies) as world-state entries with free-text Thai
// names/roles plus a one-line `portrait` appearance hint (update-state prompt);
// these keyword tables route them at the library's profession, monster, and
// personality-variant groups. Best effort by design — any miss falls through
// to a sensible pool, never to "no portrait".

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

// Plain 'ตา' is dropped on purpose — in hint text it is usually eyes ("ตาลึก").
const WOMAN_HINTS = [
	'ป้า',
	'ยาย',
	'คุณยาย',
	'แม่',
	'นาง',
	'หญิง',
	'ผู้หญิง',
	'หญิงสาว',
	'สาว',
	'เด็กหญิง',
	'คุณหญิง',
	'หม่อม'
];
const MAN_HINTS = ['ลุง', 'คุณตา', 'ตาแก่', 'พ่อ', 'นาย', 'ชาย', 'ผู้ชาย', 'เด็กชาย', 'หนุ่ม'];
const ELDERLY_HINTS = ['ชรา', 'วัยชรา', 'อายุมาก', 'แก่', 'เฒ่า', 'ชราภา'];
const ADULT_AGES = ['man', 'woman', 'grandpa', 'grandma'];

function firstHit(haystack: string, table: Array<[string, string[]]>): string | null {
	for (const [tag, words] of table) {
		if (words.some((word) => haystack.includes(word))) return tag;
	}
	return null;
}

/**
 * Portrait for a world-state NPC (or enemy — monsters route via name/role
 * keywords). The GM's `portrait` hint steers gender, age, and temperament;
 * a friendly/hostile disposition biases the face when the hint is silent.
 * Fallback chain: monster → profession/role (± look) → adults → anything;
 * tie-break stable per NPC name. Empty library → null.
 */
export function pickNpcPortrait(
	entries: PortraitEntry[],
	npcName: string,
	npcRole: string,
	npcPortrait = '',
	disposition = 0
): PortraitEntry | null {
	const usable = entries.filter(
		(entry) => entry.bucket === PORTRAIT_BUCKET && entry.available !== false
	);
	if (usable.length === 0) return null;

	const hay = `${npcName} ${npcRole}`.toLowerCase();
	const lookHay = npcPortrait.toLowerCase();

	// 1) monsters — matched on name/role ONLY: an appearance hint must not
	//    summon a monster (a human described "หน้าซีดเหมือนผี" stays human).
	//    หมอผี (shaman — a game class) and ผีเสื้อ (butterfly) contain the
	//    ghost keyword ผี; strip them so humans stay human.
	const monsterHay = hay.replaceAll('หมอผี', ' ').replaceAll('ผีเสื้อ', ' ');
	const monster = firstHit(monsterHay, MONSTER_KEYWORDS);
	if (monster) {
		let pool = usable.filter((entry) => entry.tags[0] === 'monster' && entry.tags[1] === monster);
		if (pool.length > 0) return pickFrom(pool, npcName);
		pool = usable.filter((entry) => entry.tags[0] === 'monster');
		if (pool.length > 0) return pickFrom(pool, npcName);
	}

	// 2) profession (library professions first, then the hero-role vocabulary)
	const profTag = firstHit(hay, PROFESSION_KEYWORDS) ?? roleTagForClass(npcRole);

	// Look: gender + age from name/role/hint; temperament from the hint, with
	// disposition as the fallback signal (ภักดี smiles, เกลียดชัง glares).
	const text = `${hay} ${lookHay}`;
	const isWoman = WOMAN_HINTS.some((word) => text.includes(word));
	const isMan = MAN_HINTS.some((word) => text.includes(word));
	const gender: 'woman' | 'man' | null =
		isWoman && !isMan ? 'woman' : isMan && !isWoman ? 'man' : null;
	const elderly = ELDERLY_HINTS.some((word) => text.includes(word));
	const genderTags =
		gender === 'woman'
			? elderly
				? ['woman', 'grandma']
				: ['woman']
			: gender === 'man'
				? elderly
					? ['man', 'grandpa']
					: ['man']
				: elderly
					? ['grandpa', 'grandma']
					: null;
	const matchesLook = (entry: PortraitEntry) =>
		genderTags === null || entry.tags.some((tag) => genderTags.includes(tag));
	const expression =
		expressionTagFor(lookHay) ??
		(disposition >= 2 ? 'cheerful' : disposition <= -2 ? 'stern' : null);

	let pool = usable.filter(
		(entry) => entry.tags[0] !== 'monster' && entry.tags.includes(profTag) && matchesLook(entry)
	);
	if (pool.length > 0) return pickFrom(preferExpression(pool, expression), npcName);
	pool = usable.filter((entry) => entry.tags[0] !== 'monster' && entry.tags.includes(profTag));
	if (pool.length > 0) return pickFrom(preferExpression(pool, expression), npcName);

	// 3) any adult human (kids read wrong for arbitrary NPCs)
	pool = usable.filter(
		(entry) =>
			entry.tags[0] !== 'monster' && ADULT_AGES.includes(entry.tags[0]) && matchesLook(entry)
	);
	if (pool.length > 0) return pickFrom(preferExpression(pool, expression), npcName);
	pool = usable.filter(
		(entry) => entry.tags[0] !== 'monster' && ADULT_AGES.includes(entry.tags[0])
	);
	if (pool.length > 0) return pickFrom(pool, npcName);
	return pickFrom(usable, npcName);
}
