import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	pickNpcPortrait,
	pickPortrait,
	roleTagForClass,
	type PortraitEntry
} from '$lib/game/portraits';
import { SCENARIOS } from '$lib/game/scenarios';

// --- the committed catalog (assets/portraits.json) ---------------------------

const AGES = ['boy', 'girl', 'man', 'woman', 'grandpa', 'grandma'];
const ROLES = ['poor', 'commoner', 'merchant', 'warrior', 'mystic', 'noble'];

interface CatalogEntry {
	file: string;
	bucket: string;
	tags: string[];
}

function loadCatalog(): CatalogEntry[] | null {
	try {
		const raw = JSON.parse(readFileSync(resolve('assets/portraits.json'), 'utf8')) as {
			portraits?: CatalogEntry[];
		};
		return raw.portraits ?? [];
	} catch {
		return null; // fresh clone before generation
	}
}

describe('portrait catalog (assets/portraits.json)', () => {
	const catalog = loadCatalog();

	it('exists and parses (generation has run)', () => {
		expect(catalog, 'assets/portraits.json missing — run npm run portraits').not.toBeNull();
	});

	it.skipIf(!catalog)('entries are well-formed and every group matrix is present', () => {
		const entries = catalog!;
		expect(entries.length).toBe(192);
		const seen = new Set<string>();
		for (const entry of entries) {
			expect(entry.bucket, entry.file).toBe('anime'); // realistic bucket dropped by user review
			expect(entry.file.endsWith('.png'), entry.file).toBe(true);
			expect(entry.tags.length, entry.file).toBeGreaterThanOrEqual(2);
			expect(seen.has(entry.file), `duplicate ${entry.file}`).toBe(false);
			seen.add(entry.file);
		}
		// heroes: 6 ages × 6 roles × 2 checkpoints
		for (const age of AGES) {
			for (const role of ROLES) {
				for (const cp of ['illustrious', 'noobai']) {
					expect(seen.has(`anime_${age}_${role}_${cp}.png`), `hero ${age}/${role}/${cp}`).toBe(
						true
					);
				}
			}
		}
		// personality variants: man+woman × roles × expressions × 2 checkpoints
		const GENDERS = ['man', 'woman'];
		const EXPRESSIONS = ['cheerful', 'stern', 'dull'];
		for (const gender of GENDERS) {
			for (const role of ROLES) {
				for (const expr of EXPRESSIONS) {
					for (const cp of ['illustrious', 'noobai']) {
						expect(
							seen.has(`anime_${gender}_${role}_${expr}_${cp}.png`),
							`variant ${gender}/${role}/${expr}/${cp}`
						).toBe(true);
					}
				}
			}
		}
		// professions: man+woman × 6 professions × 2 checkpoints
		const PROFESSIONS = ['innkeeper', 'guard', 'blacksmith', 'servant', 'farmer', 'priest'];
		for (const gender of GENDERS) {
			for (const prof of PROFESSIONS) {
				for (const cp of ['illustrious', 'noobai']) {
					expect(
						seen.has(`anime_${gender}_${prof}_${cp}.png`),
						`prof ${gender}/${prof}/${cp}`
					).toBe(true);
				}
			}
		}
		// monsters: 12 × 2 checkpoints
		const MONSTERS = [
			'goblin',
			'orc',
			'slime',
			'dragon',
			'skeleton',
			'ghost',
			'wolf',
			'bandit',
			'troll',
			'kobold',
			'golem',
			'harpy'
		];
		for (const monster of MONSTERS) {
			for (const cp of ['illustrious', 'noobai']) {
				expect(seen.has(`anime_monster_${monster}_${cp}.png`), `monster ${monster}/${cp}`).toBe(
					true
				);
			}
		}
	});

	// Binaries are gitignored — a fresh clone has the catalog but no images
	// until `npm run portraits`; the test battery must not fail there.
	it.skipIf(!existsSync(resolve('static/assets/portraits')))(
		'every catalog entry has its binary on disk',
		() => {
			for (const entry of catalog!) {
				expect(
					existsSync(resolve('static/assets/portraits', entry.file)),
					`binary missing: ${entry.file}`
				).toBe(true);
			}
		}
	);
});

// --- selection logic (lib/game/portraits.ts) ---------------------------------

const LIB: PortraitEntry[] = [
	{ file: 'anime_boy_warrior_illustrious.png', bucket: 'anime', tags: ['boy', 'warrior'] },
	{ file: 'anime_girl_mystic_noobai.png', bucket: 'anime', tags: ['girl', 'mystic'] },
	{ file: 'anime_man_noble_illustrious.png', bucket: 'anime', tags: ['man', 'noble'] },
	{ file: 'realistic_man_warrior_arien.png', bucket: 'realistic', tags: ['man', 'warrior'] }
];

describe('roleTagForClass (Thai class → role tag)', () => {
	it('maps magic-speakers to mystic', () => {
		for (const klass of ['นักเวท', 'หมอผี', 'นักบวช', 'นักปราชญ์', 'นักเวทน้ำแข็งรุ่นใหม่']) {
			expect(roleTagForClass(klass), klass).toBe('mystic');
		}
	});
	it('maps fighters to warrior', () => {
		for (const klass of ['นักดาบ', 'อัศวิน', 'นักล่า', 'นักธนู', 'ทหาร', 'นักดาบพเนจร']) {
			expect(roleTagForClass(klass), klass).toBe('warrior');
		}
	});
	it('maps merchants, nobles, thieves', () => {
		expect(roleTagForClass('พ่อค้าเร่ร่อน')).toBe('merchant');
		expect(roleTagForClass('ขุนนาง')).toBe('noble');
		expect(roleTagForClass('โจร')).toBe('poor');
	});
	it('defaults to commoner', () => {
		expect(roleTagForClass('ช่างตีเหล็ก')).toBe('commoner');
		expect(roleTagForClass('')).toBe('commoner');
	});
});

describe('pickPortrait', () => {
	it('never leaves the anime bucket (dropped styles stay dropped)', () => {
		for (let i = 0; i < 20; i++) {
			const pick = pickPortrait(LIB, 'นักดาบ', `seed-${i}`);
			expect(pick?.bucket).toBe('anime');
		}
	});
	it('prefers the class-matching role tag', () => {
		const pick = pickPortrait(LIB, 'นักเวท', 'ริน วาเลียร์');
		expect(pick?.tags).toContain('mystic');
	});
	it('falls back within the library when no role matches', () => {
		const pick = pickPortrait(LIB, 'ช่างตีเหล็ก', 'seed');
		expect(pick).not.toBeNull();
	});
	it('is deterministic per seedKey (hero name)', () => {
		const a = pickPortrait(LIB, 'นักดาบ', 'เอเดริก เวลฮาร์ด');
		const b = pickPortrait(LIB, 'นักดาบ', 'เอเดริก เวลฮาร์ด');
		expect(a?.file).toBe(b?.file);
	});
	it('empty library → null (fresh clone)', () => {
		expect(pickPortrait([], 'นักดาบ', 'x')).toBeNull();
	});
	it('unavailable entries are skipped', () => {
		const lib: PortraitEntry[] = [
			{ ...LIB[0], available: false },
			{ ...LIB[1], available: true }
		];
		const pick = pickPortrait(lib, 'นักดาบ', 'x');
		expect(pick?.file).toBe('anime_girl_mystic_noobai.png');
	});
});

describe('the anime-only pivot left no stale fields', () => {
	it('scenarios no longer carry artStyle', () => {
		for (const scenario of SCENARIOS) {
			expect((scenario as unknown as Record<string, unknown>).artStyle).toBeUndefined();
		}
	});
});

// --- NPC & monster faces (pickNpcPortrait) -----------------------------------

const NPC_LIB: PortraitEntry[] = [
	{ file: 'a.png', bucket: 'anime', tags: ['man', 'innkeeper'] },
	{ file: 'b.png', bucket: 'anime', tags: ['woman', 'innkeeper', 'cheerful'] },
	{ file: 'c.png', bucket: 'anime', tags: ['man', 'guard'] },
	{ file: 'd.png', bucket: 'anime', tags: ['woman', 'guard'] },
	{ file: 'e.png', bucket: 'anime', tags: ['boy', 'warrior'] },
	{ file: 'f.png', bucket: 'anime', tags: ['monster', 'goblin'] },
	{ file: 'g.png', bucket: 'anime', tags: ['monster', 'dragon'] },
	{ file: 'h.png', bucket: 'anime', tags: ['monster', 'slime'] },
	{ file: 'i.png', bucket: 'anime', tags: ['monster', 'ghost'] }
];

describe('pickNpcPortrait (NPC + monster routing)', () => {
	it('routes monsters by name keyword', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'กอบลินยามเฝ้า', 'ปีศาจตัวน้อย');
		expect(pick?.tags).toEqual(['monster', 'goblin']);
	});
	it('routes monsters by role keyword and falls back within monsters', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'อสุรา', 'มังกรเล็ก');
		expect(pick?.tags[0]).toBe('monster');
		expect(pick?.tags[1]).toBe('dragon');
	});
	it('unknown creature still gets a monster face', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'สัตว์อสูรป่า', 'สไลม์ยักษ์');
		expect(pick?.tags[0]).toBe('monster');
	});
	it('routes professions by keyword with gender hint from the name', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'แม่เม้าป้านา', 'เจ้าของโรงเหล้า');
		expect(pick?.tags).toContain('innkeeper');
		expect(pick?.tags).toContain('woman');
	});
	it('routes watch/guard roles to the guard group', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'ยามหน้าประตู', 'ทหารรักษาประตูเมือง');
		expect(pick?.tags).toContain('guard');
	});
	it('falls through to hero-role vocabulary for unmatched roles', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'นักดาบพเนจร', 'อัศวินผู้สาบาน');
		expect(pick?.tags).toContain('warrior');
	});
	it('generic NPCs get an adult, never a monster', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'คนแปลกหน้า', 'พ่อค้าเร่');
		expect(pick).not.toBeNull();
		expect(pick!.tags[0]).not.toBe('monster');
	});
	it('is deterministic per NPC name', () => {
		const a = pickNpcPortrait(NPC_LIB, 'ป้าสมจิตร', 'แม่เม้าโรงเหล้า');
		const b = pickNpcPortrait(NPC_LIB, 'ป้าสมจิตร', 'แม่เม้าโรงเหล้า');
		expect(a?.file).toBe(b?.file);
	});
	it('empty library → null', () => {
		expect(pickNpcPortrait([], 'ใครสักคน', 'ใครก็ได้')).toBeNull();
	});
	it('หมอผี (a shipped hero class) stays human — never the ghost monster', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'หมอผีเฒ่าทอง', 'หมอผีประจำหมู่บ้าน');
		expect(pick?.tags[0]).not.toBe('monster');
	});
	it('ผีเสื้อ (butterfly) is not a ghost', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'ป้าผีเสื้อ', 'แม่ค้าขายผีเสื้อ');
		expect(pick?.tags[0]).not.toBe('monster');
	});
	it('a real ghost NPC still routes to the ghost art', () => {
		const pick = pickNpcPortrait(NPC_LIB, 'ผีสาวในโรงสี', 'วิญญาณที่ยังไม่สูญ');
		expect(pick?.tags).toEqual(['monster', 'ghost']);
	});
});
