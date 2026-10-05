import { describe, expect, it } from 'vitest';
import {
	applyDamage,
	applyLevelUp,
	check,
	damage,
	maxHp,
	maxMp,
	mockRng,
	mulberry32,
	rollDie,
	statMod,
	xpToNext
} from './rules';

describe('statMod (1–10 → −2..+2)', () => {
	it('maps each band correctly', () => {
		expect(statMod(1)).toBe(-2);
		expect(statMod(2)).toBe(-2);
		expect(statMod(3)).toBe(-1);
		expect(statMod(4)).toBe(-1);
		expect(statMod(5)).toBe(0);
		expect(statMod(6)).toBe(0);
		expect(statMod(7)).toBe(1);
		expect(statMod(8)).toBe(1);
		expect(statMod(9)).toBe(2);
		expect(statMod(10)).toBe(2);
	});

	it('clamps out-of-range values into the outermost bands', () => {
		expect(statMod(0)).toBe(-2);
		expect(statMod(11)).toBe(2);
	});
});

describe('pools', () => {
	it('HP = 20 + VIT × 4', () => {
		expect(maxHp(1)).toBe(24);
		expect(maxHp(6)).toBe(44);
		expect(maxHp(10)).toBe(60);
	});

	it('มานา = 8 + (INT + SPI) × 2 — both mind stats feed the pool', () => {
		expect(maxMp(5, 5)).toBe(28);
		expect(maxMp(10, 8)).toBe(44);
		expect(maxMp(1, 1)).toBe(12);
	});
});

describe('rng + dice', () => {
	it('same seed → same sequence (reproducible rolls)', () => {
		const a = mulberry32(1234);
		const b = mulberry32(1234);
		for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
	});

	it('produces values in [0,1)', () => {
		const rng = mulberry32(7);
		for (let i = 0; i < 1000; i++) {
			const v = rng.next();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('rollDie stays in [1, sides] across many rolls', () => {
		const rng = mulberry32(99);
		for (let i = 0; i < 500; i++) {
			const roll = rollDie(20, rng);
			expect(Number.isInteger(roll)).toBe(true);
			expect(roll).toBeGreaterThanOrEqual(1);
			expect(roll).toBeLessThanOrEqual(20);
		}
	});

	it('rollDie maps rng values deterministically', () => {
		expect(rollDie(20, mockRng([0]))).toBe(1);
		expect(rollDie(20, mockRng([0.95]))).toBe(20);
		expect(rollDie(4, mockRng([0.5]))).toBe(3);
	});
});

describe('check (d20 + mod vs DC)', () => {
	it('nat 20 is always a crit', () => {
		const r = check(1, DC_Hard, mockRng([0.95]));
		expect(r.die).toBe(20);
		expect(r.outcome).toBe('crit');
	});

	it('nat 1 is always a fumble — never a plain fail', () => {
		const r = check(1, 8, mockRng([0]));
		expect(r.die).toBe(1);
		expect(r.outcome).toBe('fumble');
		expect(r.total).toBe(-1); // 1 + (−2)
	});

	it('success when total meets DC', () => {
		const r = check(7, 14, mockRng([0.6])); // die 13, mod +1 → 14 vs 14
		expect(r).toMatchObject({ die: 13, mod: 1, total: 14, outcome: 'success', margin: 0 });
	});

	it('fail below DC', () => {
		const r = check(5, 15, mockRng([0.6])); // die 13, mod 0 → 13 vs 15
		expect(r.outcome).toBe('fail');
		expect(r.margin).toBe(-2);
	});
});

const DC_Hard = 18;

describe('damage + armor', () => {
	it('melee adds the STR modifier', () => {
		// sword d6: rng 0.5 → die 4; STR 9 → +2
		expect(damage('sword', mockRng([0.5]), 9)).toMatchObject({ base: 4, strMod: 2, total: 6 });
		// negative STR mod can never reduce below 1
		expect(damage('dagger', mockRng([0]), 1)).toMatchObject({ base: 1, strMod: -2, total: 1 });
	});

	it('ranged adds no STR modifier', () => {
		expect(damage('bow', mockRng([0.5]), 10)).toMatchObject({ base: 4, strMod: 0, total: 4 });
	});

	it('greatweapon rolls a d10', () => {
		expect(damage('greatweapon', mockRng([0.9]), 5)).toMatchObject({
			base: 10,
			strMod: 0,
			total: 10
		});
	});

	it('armor reduces flat DR, shield +1, HP floors at 0', () => {
		expect(applyDamage(40, 10, 'leather')).toBe(31); // 10 − DR 1
		expect(applyDamage(40, 10, 'plate')).toBe(33); // 10 − 3
		expect(applyDamage(40, 10, 'chain', true)).toBe(33); // 10 − (2 + 1)
		expect(applyDamage(3, 10, 'none')).toBe(0);
	});
});

describe('leveling', () => {
	it('XP thresholds double per level (L1→2 = 100)', () => {
		expect(xpToNext(1)).toBe(100);
		expect(xpToNext(2)).toBe(200);
		expect(xpToNext(3)).toBe(400);
		expect(xpToNext(9)).toBe(25600);
	});

	it('level-up pools: +HP(VIT×2) +MP(INT×2)', () => {
		const next = applyLevelUp({ level: 1, hp: 40, maxHp: 44, mp: 20, maxMp: 28 }, 6, 8);
		expect(next).toEqual({ level: 2, hp: 52, maxHp: 56, mp: 36, maxMp: 44 });
	});
});
