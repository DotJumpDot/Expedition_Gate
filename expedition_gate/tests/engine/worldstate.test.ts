import { describe, expect, it } from 'vitest';
import {
	acceptStateUpdate,
	initialWorldState,
	serializeWorldState,
	WorldStateSchema,
	type Hero,
	type WorldBrief
} from '$lib/server/engine/worldstate';

const BRIEF: WorldBrief = {
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่ หมู่บ้านริมลำธัน',
	situation: 'รอยเท้ายักษ์ปรากฏทุกเช้ามืด',
	hooks: ['ตามรอยเท้า'],
	npcs: [{ name: 'ลุงหมึก', role: 'พ่อค้าของชำ' }]
};

function makeHero(overrides: Partial<Hero> = {}): Hero {
	return {
		name: 'ตะวัน',
		concept: 'นักเวทผู้ถูกขับไล่',
		klass: 'นักเวท',
		level: 1,
		xp: 0,
		stats: { str: 5, agi: 6, dex: 5, vit: 6, int: 8, spi: 9, cha: 7, luk: 6 },
		hp: 44,
		maxHp: 44,
		mp: 34,
		maxMp: 34,
		conditions: [],
		equipment: { weapon: { key: 'sword', label: 'ดาบเหล็ก' } },
		inventory: [{ name: 'เปื้อน้ำ', qty: 2 }],
		gold: 100,
		luckPoints: 6,
		...overrides
	};
}

describe('WorldStateSchema', () => {
	it('accepts a well-formed state', () => {
		const state = initialWorldState(BRIEF, makeHero());
		expect(WorldStateSchema.safeParse(state).success).toBe(true);
	});

	it('rejects stats outside 1..10', () => {
		const state = initialWorldState(BRIEF, makeHero());
		const bad = { ...state, hero: { ...state.hero, stats: { ...state.hero.stats, str: 11 } } };
		expect(WorldStateSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects an unknown sceneTag (controlled vocabulary)', () => {
		const state = initialWorldState(BRIEF, makeHero());
		const bad = { ...state, world: { ...state.world, sceneTag: 'school-cafeteria' } };
		expect(WorldStateSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects disposition outside -3..3', () => {
		const state = initialWorldState(BRIEF, makeHero());
		const bad = {
			...state,
			npcs: [{ ...state.npcs[0], disposition: 9 }]
		};
		expect(WorldStateSchema.safeParse(bad).success).toBe(false);
	});
});

describe('initialWorldState', () => {
	it('seeds NPCs and the first quest from the brief', () => {
		const state = initialWorldState(BRIEF, makeHero());
		expect(state.npcs).toHaveLength(1);
		expect(state.npcs[0].name).toBe('ลุงหมึก');
		expect(state.quests[0].title).toBe('ตามรอยเท้า');
		expect(state.world.day).toBe(1);
	});
});

describe('acceptStateUpdate (app math wins)', () => {
	it('merges app-computed HP/gold over the LLM proposal', () => {
		const previous = initialWorldState(BRIEF, makeHero());
		const proposed = {
			...previous,
			hero: { ...previous.hero, hp: 10, gold: 999 }
		};
		const result = acceptStateUpdate(proposed, previous, { hp: 37, gold: 95 });
		expect(result).not.toBeNull();
		expect(result!.state.hero.hp).toBe(37);
		expect(result!.state.hero.gold).toBe(95);
		expect(result!.stale).toBe(false);
	});

	it('returns null on invalid proposals (caller keeps previous state)', () => {
		const previous = initialWorldState(BRIEF, makeHero());
		expect(acceptStateUpdate({ hero: { name: 'ศัตรู' } }, previous, {})).toBeNull();
	});
});

describe('serializeWorldState', () => {
	it('renders compact ground truth with Thai labels for the GM prompt', () => {
		const state = initialWorldState(BRIEF, makeHero());
		const text = serializeWorldState(state);
		expect(text).toContain('ฮีโร่: ตะวัน');
		expect(text).toContain('HP 44/44');
		expect(text).toContain('ลุงหมึก');
		expect(text).toContain('เป็นกลาง');
		expect(text).toContain('กำลังทำ');
	});
});
