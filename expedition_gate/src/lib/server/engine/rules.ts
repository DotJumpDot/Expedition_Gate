/**
 * Pure game math (Docs/02_GAME_DESIGN.md) — the app computes, the model narrates.
 * Every function here is deterministic given an RNG, so tests use seeded/mock RNGs.
 */

export type StatKey = 'str' | 'agi' | 'dex' | 'vit' | 'int' | 'spi' | 'cha' | 'luk';

export const STAT_KEYS: readonly StatKey[] = [
	'str',
	'agi',
	'dex',
	'vit',
	'int',
	'spi',
	'cha',
	'luk'
];

/** Thai display names, grouped กาย / จิต / ชะตา for the hero sheet. */
export const STAT_LABELS_TH: Record<StatKey, string> = {
	str: 'พลัง',
	agi: 'ความว่องไว',
	dex: 'ความแม่นยำ',
	vit: 'พลังชีวิต',
	int: 'สติปัญญา',
	spi: 'จิตวิญญาณ',
	cha: 'เสน่ห์',
	luk: 'ดวง'
};

export type Stats = Record<StatKey, number>;

/** Point-buy budget at creation; each stat 1–10, minimum 1. */
export const STAT_POINT_BUDGET = 52;
export const STAT_MIN = 1;
export const STAT_MAX = 10;

/** Check modifier by stat value: 1–2 → −2 · 3–4 → −1 · 5–6 → 0 · 7–8 → +1 · 9–10 → +2. */
export function statMod(value: number): number {
	const v = Math.round(value);
	if (v <= 2) return -2;
	if (v <= 4) return -1;
	if (v <= 6) return 0;
	if (v <= 8) return 1;
	return 2;
}

/** HP = 20 + VIT × 4 */
export function maxHp(vit: number): number {
	return 20 + vit * 4;
}

/** มานา = 8 + (INT + SPI) × 2 — both mind stats feed the pool. */
export function maxMp(int: number, spi: number): number {
	return 8 + (int + spi) * 2;
}

/** Difficulty classes: 8 ง่ายมาก · 12 ง่าย · 15 ปกติ · 18 ยาก · 22 แทบเป็นไปไม่ได้. */
export const DC = {
	trivial: 8,
	easy: 12,
	normal: 15,
	hard: 18,
	nearlyImpossible: 22
} as const;

// ---------------------------------------------------------------------------
// RNG — injectable so tests are deterministic and rolls are auditable.
// ---------------------------------------------------------------------------

export interface Rng {
	/** Uniform float in [0, 1). */
	next(): number;
}

/** Small deterministic PRNG (mulberry32) — reproducible rolls from a seed. */
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return {
		next() {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		}
	};
}

/** Queued-values RNG for exact-outcome tests. */
export function mockRng(values: number[]): Rng {
	let i = 0;
	return {
		next() {
			if (i >= values.length) throw new Error(`mockRng exhausted (used ${values.length} values)`);
			return values[i++];
		}
	};
}

/** Roll one die with `sides` (1-based, inclusive). */
export function rollDie(sides: number, rng: Rng): number {
	if (sides < 1) throw new Error(`sides must be >= 1, got ${sides}`);
	return 1 + Math.floor(rng.next() * sides);
}

// ---------------------------------------------------------------------------
// Checks — d20 + stat mod vs DC. Nat 20 crit, nat 1 fumble (never instant death).
// ---------------------------------------------------------------------------

export type CheckOutcome = 'crit' | 'success' | 'fail' | 'fumble';

export interface CheckResult {
	die: number;
	mod: number;
	total: number;
	dc: number;
	outcome: CheckOutcome;
	/** total − dc (positive = cleared it). */
	margin: number;
}

export function check(statValue: number, dc: number, rng: Rng): CheckResult {
	const die = rollDie(20, rng);
	const mod = statMod(statValue);
	const total = die + mod;
	let outcome: CheckOutcome;
	if (die === 20) outcome = 'crit';
	else if (die === 1) outcome = 'fumble';
	else outcome = total >= dc ? 'success' : 'fail';
	return { die, mod, total, dc, outcome, margin: total - dc };
}

/** Thai resolution line injected into the GM turn (the model must obey it verbatim). */
export function describeCheck(stat: StatKey, r: CheckResult): string {
	const modStr = r.mod >= 0 ? `+${r.mod}` : `${r.mod}`;
	const outcomeTh: Record<CheckOutcome, string> = {
		crit: 'สำเร็จอย่างสมบูรณ์ (ขวัญตา)',
		success: 'สำเร็จ',
		fail: 'ไม่สำเร็จ',
		fumble: 'พลาดยับ (ขวัญหาย)'
	};
	return `ผลการตัดสิน (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(${r.die}) + ${stat.toUpperCase()}(${modStr}) = ${r.total} vs DC ${r.dc} → ${outcomeTh[r.outcome]}`;
}

// ---------------------------------------------------------------------------
// Damage — weapon dice + STR mod on melee; armor = flat damage reduction.
// ---------------------------------------------------------------------------

export type WeaponKey = 'dagger' | 'sword' | 'axe' | 'greatweapon' | 'bow';

export interface WeaponSpec {
	key: WeaponKey;
	labelTh: string;
	sides: number;
	/** Ranged weapons key off DEX and add no STR mod. */
	ranged: boolean;
}

export const WEAPONS: Record<WeaponKey, WeaponSpec> = {
	dagger: { key: 'dagger', labelTh: 'มีด', sides: 4, ranged: false },
	sword: { key: 'sword', labelTh: 'ดาบ/กระบอง', sides: 6, ranged: false },
	axe: { key: 'axe', labelTh: 'ขวาน/คทา', sides: 8, ranged: false },
	greatweapon: { key: 'greatweapon', labelTh: 'อาวุธใหญ่', sides: 10, ranged: false },
	bow: { key: 'bow', labelTh: 'ธนู', sides: 6, ranged: true }
};

export type ArmorKey = 'cloth' | 'leather' | 'chain' | 'plate' | 'none';

/** Flat damage reduction: cloth 0 · leather 1 · chain 2 · plate 3 (shield +1). */
export const ARMOR_DR: Record<ArmorKey, number> = {
	none: 0,
	cloth: 0,
	leather: 1,
	chain: 2,
	plate: 3
};

export interface DamageResult {
	weapon: WeaponKey;
	rolls: number[];
	base: number;
	strMod: number;
	total: number;
}

/** Roll weapon damage; melee adds the STR modifier (can be negative). */
export function damage(weapon: WeaponKey, rng: Rng, strStatValue?: number): DamageResult {
	const spec = WEAPONS[weapon];
	const roll = rollDie(spec.sides, rng);
	const strMod = spec.ranged || strStatValue === undefined ? 0 : statMod(strStatValue);
	return { weapon, rolls: [roll], base: roll, strMod, total: Math.max(1, roll + strMod) };
}

/** Apply incoming damage after armor reduction; HP floors at 0. */
export function applyDamage(
	hp: number,
	rawDamage: number,
	armor: ArmorKey = 'none',
	shield = false
): number {
	const dr = ARMOR_DR[armor] + (shield ? 1 : 0);
	return Math.max(0, hp - Math.max(0, rawDamage - dr));
}

// ---------------------------------------------------------------------------
// Leveling — XP thresholds double per level; L1→2 = 100 XP. Soft cap L10.
// ---------------------------------------------------------------------------

export const LEVEL_SOFT_CAP = 10;

/** XP needed to advance FROM `level` to level+1. */
export function xpToNext(level: number): number {
	return 100 * 2 ** (level - 1);
}

export interface LevelUpPools {
	level: number;
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
}

/** Level-up math: +HP(VIT×2) +MP(INT×2); +2 stat points are spent by the player. */
export function applyLevelUp(pools: LevelUpPools, vit: number, int: number): LevelUpPools {
	return {
		level: pools.level + 1,
		hp: pools.hp + vit * 2,
		maxHp: pools.maxHp + vit * 2,
		mp: pools.mp + int * 2,
		maxMp: pools.maxMp + int * 2
	};
}
