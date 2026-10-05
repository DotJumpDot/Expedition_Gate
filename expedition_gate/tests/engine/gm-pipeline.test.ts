// @vitest-environment node
// Talks to the real fake-llama stub over sockets — node env, not happy-dom.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeLlama } from '../fake-llama/server.mjs';
import {
	buildGmMessages,
	generateHeroProposal,
	generateWorldBrief,
	parseJsonLoose,
	updateWorldState
} from '$lib/server/engine/gm';
import {
	initialWorldState,
	WorldBriefSchema,
	type Hero,
	type WorldBrief
} from '$lib/server/engine/worldstate';

let server: ReturnType<typeof createFakeLlama>;
let baseUrl = '';

const BRIEF: WorldBrief = WorldBriefSchema.parse({
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่',
	situation: 'รอยเท้ายักษ์ปรากฏทุกเช้ามืด',
	hooks: ['ตามรอยเท้า'],
	npcs: []
});

function makeHero(): Hero {
	return {
		name: 'ตะวัน',
		concept: 'นักเวทผู้ถูกขับไล่',
		klass: 'นักเวท',
		level: 1,
		xp: 0,
		stats: { str: 4, agi: 6, dex: 5, vit: 5, int: 8, spi: 9, cha: 7, luk: 8 },
		hp: 40,
		maxHp: 40,
		mp: 34,
		maxMp: 34,
		conditions: [],
		equipment: { weapon: { key: 'sword', label: 'ดาบเหล็ก' } },
		inventory: [{ name: 'เปื้อน้ำ', qty: 2 }],
		gold: 120,
		luckPoints: 8
	};
}

beforeAll(async () => {
	server = createFakeLlama();
	await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('no port');
	baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(() => server.close());

describe('generateWorldBrief (JSON call + zod)', () => {
	it('parses the stub world-brief fixture', async () => {
		const result = await generateWorldBrief({ setting: 'thai_legend', tone: ['มืดมน'] }, baseUrl);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.brief.name).toBe('ทุ่งประตูหิน');
			expect(result.brief.hooks).toHaveLength(3);
		}
	});
});

describe('generateHeroProposal', () => {
	it('parses the stub hero fixture — stats must sum to the 52-point budget', async () => {
		const result = await generateHeroProposal(
			{ brief: BRIEF, name: 'ตะวัน', concept: '', klass: 'นักเวท' },
			baseUrl
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const total = Object.values(result.proposal.stats).reduce((sum, value) => sum + value, 0);
			expect(total).toBe(52);
			expect(result.proposal.weapon.key).toBe('sword');
		}
	});
});

describe('updateWorldState', () => {
	it('accepts the stub state fixture and applies app math over it', async () => {
		const current = initialWorldState(BRIEF, makeHero());
		const result = await updateWorldState({
			current,
			playerInput: 'ผมจะโจมตี',
			narration: 'คุณฟันเข้าเต็มแรง',
			appMath: { hp: 12, gold: 3 },
			baseUrl
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			// fixture hero wins structure, app math wins values
			expect(result.state.hero.name).toBe('ตะวัน');
			expect(result.state.hero.hp).toBe(12);
			expect(result.state.hero.gold).toBe(3);
			expect(result.state.world.sceneTag).toBe('village');
		}
	});
});

describe('buildGmMessages (assembly order per Docs/04)', () => {
	it('system prompt carries persona, state, policy, few-shot; user carries resolution + input', () => {
		const state = initialWorldState(BRIEF, makeHero());
		const messages = buildGmMessages({
			brief: BRIEF,
			state,
			history: [
				{ role: 'player', content: 'สวัสดีชาวบ้าน' },
				{ role: 'gm', content: 'ชาวบ้านพยักหน้าให้คุณ' }
			],
			resolutionLine: 'd20(14) + SPI(+1) = 15 vs DC 15 → สำเร็จ',
			playerInput: 'ผมจะสำรวจรอยเท้า'
		});

		expect(messages[0].role).toBe('system');
		expect(messages.at(-1)?.role).toBe('user');
		// ground truth injected
		expect(messages[0].content).toContain('สถานะโลกปัจจุบัน');
		expect(messages[0].content).toContain('ตะวัน');
		// content policy + hard limits present
		expect(messages[0].content).toContain('ข้อห้ามเด็ดขาด');
		// few-shot examples present (the enforcement mechanism)
		expect(messages[0].content).toContain('ตัวอย่างบท');
		// last-instruction-wins override block at the end
		expect(messages[0].content.trim().endsWith('ไม่พูดกับผู้เล่นในฐานะโปรแกรม')).toBe(true);
		// turn user message = resolution + quick facts + input
		const user = messages.at(-1)!.content;
		expect(user).toContain('d20(14)');
		expect(user).toContain('ผู้เล่น: ผมจะสำรวจรอยเท้า');
		// history included between
		expect(messages.some((message) => message.content === 'สวัสดีชาวบ้าน')).toBe(true);
	});
});

describe('parseJsonLoose', () => {
	it('extracts JSON from fenced / prose-wrapped answers', () => {
		expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(parseJsonLoose('ผลลัพธ์คือ {"b":2} ครับ')).toEqual({ b: 2 });
		expect(parseJsonLoose('ไม่มี json เลย')).toBeUndefined();
	});
});
