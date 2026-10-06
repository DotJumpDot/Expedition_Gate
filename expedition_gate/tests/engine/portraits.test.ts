import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickPortrait, roleTagForClass, type PortraitEntry } from '$lib/game/portraits';
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

	it.skipIf(!catalog)('entries are well-formed and the full 72 anime matrix is present', () => {
		const entries = catalog!;
		expect(entries.length).toBe(72);
		const seen = new Set<string>();
		for (const entry of entries) {
			expect(entry.bucket, entry.file).toBe('anime'); // realistic bucket dropped by user review
			expect(entry.file.endsWith('.png'), entry.file).toBe(true);
			expect(entry.tags.length, entry.file).toBe(2);
			const [age, role] = entry.tags;
			expect(AGES, entry.file).toContain(age);
			expect(ROLES, entry.file).toContain(role);
			expect(seen.has(entry.file), `duplicate ${entry.file}`).toBe(false);
			seen.add(entry.file);
		}
		for (const age of AGES) {
			for (const role of ROLES) {
				for (const cp of ['illustrious', 'noobai']) {
					const file = `anime_${age}_${role}_${cp}.png`;
					expect(seen.has(file), `missing matrix entry ${file}`).toBe(true);
				}
			}
		}
	});

	it.skipIf(!catalog)('every catalog entry has its binary on disk', () => {
		for (const entry of catalog!) {
			expect(
				existsSync(resolve('static/assets/portraits', entry.file)),
				`binary missing: ${entry.file}`
			).toBe(true);
		}
	});
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
