import { describe, expect, it } from 'vitest';
import { mockRng } from '$lib/server/engine/rules';
import { resolveTurn } from '$lib/server/engine/turn';
import { initialWorldState, type Hero, type WorldBrief } from '$lib/server/engine/worldstate';

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

describe('resolveTurn — the app does the math', () => {
	it('free/opening turns resolve no mechanics', () => {
		const result = resolveTurn({ kind: 'free', text: 'เดินดูรอบตัว' }, stateWith(), mockRng([0.5]));
		expect(result.resolutionLine).toBeUndefined();
		expect(result.rolls).toBeUndefined();

		const opening = resolveTurn({ kind: 'opening', text: '' }, stateWith(), mockRng([0.5]));
		expect(opening.resolutionLine).toBeUndefined();
	});

	it('attack: hit + weapon damage with STR mod on melee', () => {
		// d20(0.5) → 11 + STR(+1) = 12 ≥ DC 13? No: 12 < 13 → miss. Pick rng for die 14:
		// die = 1 + floor(0.65*20) = 14 → 14+1 = 15 vs 13 → success; damage d6(0.5)=4 +1 = 5
		const result = resolveTurn(
			{ kind: 'attack', text: 'โจมตี!' },
			stateWith(),
			mockRng([0.65, 0.5])
		);
		expect(result.resolutionLine).toContain('d20(14)');
		expect(result.resolutionLine).toContain('ความเสียหาย');
		expect(result.resolutionLine).toContain('5 บาดแผล');
	});

	it('attack: crit doubles the damage', () => {
		// die 20 (0.95) → crit; d6 rolls 4+1=5 and 6+1=7 → 12 total
		const result = resolveTurn(
			{ kind: 'attack', text: 'โจมตี!' },
			stateWith(),
			mockRng([0.95, 0.5, 0.99])
		);
		expect(result.resolutionLine).toContain('ขวัญตา');
		expect(result.resolutionLine).toContain('12 บาดแผล');
	});

	it('bow attacks swing on DEX and add no STR mod', () => {
		const bowState = stateWith({
			stats: { str: 3, agi: 6, dex: 9, vit: 6, int: 5, spi: 5, cha: 5, luk: 5 }
		});
		bowState.hero.equipment.weapon = { key: 'bow', label: 'ธนูสั้น' };
		// die 1+floor(0.7*20)=15 → 15 + DEX(+2) = 17 ≥ 13 hit; d6(0.5)=4 no STR
		const result = resolveTurn({ kind: 'attack', text: 'ยิง!' }, bowState, mockRng([0.7, 0.5]));
		expect(result.resolutionLine).toContain('DEX(+2)');
		expect(result.resolutionLine).toContain('4 บาดแผล');
	});

	it('custom roll uses the chosen stat + DC', () => {
		// die 1+floor(0.7*20)=15 + CHA(0) = 15 vs 15 → success
		const result = resolveTurn({ kind: 'roll', text: 'งัดล็อก' }, stateWith(), mockRng([0.7]));
		expect(result.resolutionLine).toContain('d20(15) + SPI(+0) = 15 vs DC 15');
	});

	it('talk/flee checks use CHA/AGI', () => {
		const talk = resolveTurn({ kind: 'talk', text: 'ต่อรอง' }, stateWith(), mockRng([0.7]));
		expect(talk.resolutionLine).toContain('CHA');
		const flee = resolveTurn({ kind: 'flee', text: 'หนี!' }, stateWith(), mockRng([0.7]));
		expect(flee.resolutionLine).toContain('AGI');
	});
});
