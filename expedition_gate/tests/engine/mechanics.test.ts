import { describe, expect, it } from 'vitest';
import { mockRng } from '$lib/server/engine/rules';
import { resolveTurn } from '$lib/server/engine/turn';
import {
	initialWorldState,
	mergeConsumed,
	type Hero,
	type WorldBrief
} from '$lib/server/engine/worldstate';

const BRIEF: WorldBrief = {
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่',
	situation: 'รอยเท้ายักษ์',
	hooks: ['ตามรอยเท้า'],
	npcs: []
};

function stateWith(overrides: Partial<Hero> = {}) {
	const hero: Hero = {
		name: 'ตะวัน',
		concept: '',
		klass: 'นักดาบ',
		level: 1,
		xp: 0,
		stats: { str: 8, agi: 6, dex: 5, vit: 6, int: 5, spi: 5, cha: 5, luk: 5 },
		hp: 44,
		maxHp: 44,
		mp: 28,
		maxMp: 28,
		conditions: [],
		equipment: { weapon: { key: 'sword', label: 'ดาบเหล็ก' } },
		inventory: [],
		gold: 50,
		luckPoints: 5,
		...overrides
	};
	return initialWorldState(BRIEF, hero);
}

describe('declared spells — the app deducts มานา (Docs/02)', () => {
	it('standard cast costs 5 มานา and says so', () => {
		const result = resolveTurn(
			{ kind: 'free', text: 'ผมจะร่ายเวทไฟใส่กองฟืน' },
			stateWith(),
			mockRng([])
		);
		expect(result.appMath.mp).toBe(23);
		expect(result.resolutionLine).toContain('การใช้เวท');
		expect(result.resolutionLine).toContain('5');
	});

	it('big words price the cast at 8, small words at 3', () => {
		const big = resolveTurn(
			{ kind: 'free', text: 'ร่ายพายุสายฟ้าทำลายล้างศัตรูทั้งหมด' },
			stateWith(),
			mockRng([])
		);
		expect(big.appMath.mp).toBe(20);

		const small = resolveTurn(
			{ kind: 'free', text: 'เสกแสงสว่างเล็กนิดหน่อยพอมองเห็นทาง' },
			stateWith(),
			mockRng([])
		);
		expect(small.appMath.mp).toBe(25);
	});

	it('not enough มานา: no deduction, the cast fizzles', () => {
		const result = resolveTurn(
			{ kind: 'free', text: 'ร่ายมนต์คุ้มกันตัว' },
			stateWith({ mp: 2 }),
			mockRng([])
		);
		expect(result.appMath.mp).toBeUndefined();
		expect(result.resolutionLine).toContain('มานาไม่พอ');
	});

	it('text that declares no cast resolves nothing', () => {
		const result = resolveTurn(
			{ kind: 'free', text: 'เดินสำรวจรอบกองไฟ มองหาร่องรอย' },
			stateWith(),
			mockRng([])
		);
		expect(result.appMath.mp).toBeUndefined();
		expect(result.resolutionLine).toBeUndefined();
	});
});

describe('แต้มดวง — LUK spend-reroll (Docs/02)', () => {
	it('spends 1 point and rolls the same stat/DC fresh', () => {
		// die = 1 + floor(0.8*20) = 17 → 17 + SPI(0) = 17 vs 15 → สำเร็จ
		const result = resolveTurn(
			{ kind: 'reroll', text: 'ใช้แต้มดวง', stat: 'spi', dc: 15 },
			stateWith(),
			mockRng([0.8])
		);
		expect(result.appMath.luckPoints).toBe(4);
		expect(result.resolutionLine).toContain('แต้มดวง');
		expect(result.resolutionLine).toContain('d20(17)');
		expect(result.rolls?.[0]).toMatchObject({ kind: 'check', stat: 'spi' });
	});

	it('no points left: no spend, no roll, no line', () => {
		const result = resolveTurn(
			{ kind: 'reroll', text: 'ใช้แต้มดวง', stat: 'spi', dc: 15 },
			stateWith({ luckPoints: 0 }),
			mockRng([])
		);
		expect(result.appMath.luckPoints).toBeUndefined();
		expect(result.resolutionLine).toBeUndefined();
		expect(result.rolls).toBeUndefined();
	});
});

describe('use-item — potions are app math (Docs/02)', () => {
	it('healing potion: 2d6+4, capped at maxHp, item consumed', () => {
		// 2d6 both 4 (0.5) → 8 + 4 = 12; hp 30 → 42
		const result = resolveTurn(
			{ kind: 'use-item', text: 'ใช้ ยาพักฟื้น', item: 'ยาพักฟื้น' },
			stateWith({
				hp: 30,
				inventory: [
					{ name: 'ยาพักฟื้น', qty: 2 },
					{ name: 'เบ็ดตกปลา', qty: 1 }
				]
			}),
			mockRng([0.5, 0.5])
		);
		expect(result.appMath.hp).toBe(42);
		expect(result.consume).toEqual({ name: 'ยาพักฟื้น' });
		expect(result.resolutionLine).toContain('ฟื้นพลังชีวิต 12');
		expect(result.resolutionLine).toContain('30 → 42');
	});

	it('heal caps at maxHp', () => {
		const result = resolveTurn(
			{ kind: 'use-item', text: 'ใช้ ยาพักฟื้น', item: 'ยาพักฟื้น' },
			stateWith({ hp: 40, inventory: [{ name: 'ยาพักฟื้น', qty: 1 }] }),
			mockRng([0.5, 0.5])
		);
		expect(result.appMath.hp).toBe(44);
	});

	it('มานา potion restores the mp pool instead', () => {
		// 1d6(0.5) → 4 + 7 = 11; mp 10 → 21
		const result = resolveTurn(
			{ kind: 'use-item', text: 'ใช้ เฟือมานา', item: 'เฟือมานา' },
			stateWith({ mp: 10, inventory: [{ name: 'เฟือมานา', qty: 1 }] }),
			mockRng([0.5])
		);
		expect(result.appMath.mp).toBe(21);
		expect(result.appMath.hp).toBeUndefined();
		expect(result.resolutionLine).toContain('ฟื้นมานา 11');
	});

	it('item not in inventory (or not usable) → pure narration, no math', () => {
		const missing = resolveTurn(
			{ kind: 'use-item', text: 'ใช้ ยาวิเศษ', item: 'ยาวิเศษ' },
			stateWith({ hp: 30 }),
			mockRng([])
		);
		expect(missing.consume).toBeUndefined();
		expect(missing.resolutionLine).toBeUndefined();

		const unusable = resolveTurn(
			{ kind: 'use-item', text: 'ใช้ ดาบเหล็ก', item: 'ดาบเหล็ก' },
			stateWith({ hp: 30, inventory: [{ name: 'ดาบเหล็ก', qty: 1 }] }),
			mockRng([])
		);
		expect(unusable.consume).toBeUndefined();
		expect(unusable.appMath.hp).toBeUndefined();
	});

	it('a dying hero cannot drink — the death save owns the turn', () => {
		const result = resolveTurn(
			{ kind: 'use-item', text: 'ใช้ ยาพักฟื้น', item: 'ยาพักฟื้น' },
			stateWith({ hp: 0, inventory: [{ name: 'ยาพักฟื้น', qty: 1 }] }),
			mockRng([0.5])
		);
		expect(result.resolutionLine).toContain('รอดตาย');
		expect(result.consume).toBeUndefined();
	});
});

describe('mergeConsumed — app wins over the state tracker (Docs/03)', () => {
	const resolved = [
		{ name: 'ยาพักฟื้น', qty: 2 },
		{ name: 'เบ็ดตกปลา', qty: 1 }
	];

	it('forces the consumed qty to resolved−1 whatever the tracker kept', () => {
		const tracker = [
			{ name: 'ยาพักฟื้น', qty: 2 },
			{ name: 'เบ็ดตกปลา', qty: 1 }
		];
		expect(mergeConsumed(resolved, tracker, 'ยาพักฟื้น')).toEqual([
			{ name: 'ยาพักฟื้น', qty: 1 },
			{ name: 'เบ็ดตกปลา', qty: 1 }
		]);
	});

	it('restores the item if the tracker dropped it entirely', () => {
		expect(mergeConsumed(resolved, [{ name: 'เบ็ดตกปลา', qty: 1 }], 'ยาพักฟื้น')).toEqual([
			{ name: 'เบ็ดตกปลา', qty: 1 },
			{ name: 'ยาพักฟื้น', qty: 1 }
		]);
	});

	it('the last one consumed is removed outright', () => {
		const last = [{ name: 'ยาพักฟื้น', qty: 1 }];
		expect(mergeConsumed(last, last, 'ยาพักฟื้น')).toEqual([]);
	});

	it('tracker edits to OTHER items pass through untouched', () => {
		const tracker = [
			{ name: 'ยาพักฟื้น', qty: 2 },
			{ name: 'เบ็ดตกปลา', qty: 5 },
			{ name: 'แผนที่เก่า', qty: 1 }
		];
		expect(mergeConsumed(resolved, tracker, 'ยาพักฟื้น')).toEqual([
			{ name: 'ยาพักฟื้น', qty: 1 },
			{ name: 'เบ็ดตกปลา', qty: 5 },
			{ name: 'แผนที่เก่า', qty: 1 }
		]);
	});
});

describe('check rolls record their stat (reroll affordance reads it)', () => {
	it('quick-action and tray checks carry stat + dc in the roll meta', () => {
		const attack = resolveTurn(
			{ kind: 'attack', text: 'โจมตี!' },
			stateWith(),
			mockRng([0.65, 0.5])
		);
		expect(attack.rolls?.[0]).toMatchObject({ kind: 'check', stat: 'str' });

		const tray = resolveTurn(
			{ kind: 'roll', text: 'ทอยเช็ค', stat: 'agi', dc: 18 },
			stateWith(),
			mockRng([0.5])
		);
		expect(tray.rolls?.[0]).toMatchObject({ kind: 'check', stat: 'agi' });
		const first = tray.rolls?.[0];
		if (first?.kind === 'check') expect(first.detail.dc).toBe(18);
	});
});
