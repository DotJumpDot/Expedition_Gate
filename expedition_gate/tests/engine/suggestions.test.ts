// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeLlama } from '../fake-llama/server.mjs';
import {
	filterSuggestions,
	generateSuggestions,
	consolidateSessionSummary,
	generateEpilogue
} from '$lib/server/engine/gm';

let server: ReturnType<typeof createFakeLlama>;
let baseUrl = '';

beforeAll(async () => {
	server = createFakeLlama();
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('no port');
	baseUrl = `http://127.0.0.1:${address.port}/v1`;
});
afterAll(() => server.close());

describe('filterSuggestions — the player-voice guard (Docs/04 #8)', () => {
	it('rejects NPC speaker tags', () => {
		const chips = filterSuggestions(['ลุงหมึก : "ท่านอย่าไปเช้านี้นะ"', 'ถามลุงหมึกเรื่องรอยเท้า']);
		expect(chips).toEqual(['ถามลุงหมึกเรื่องรอยเท้า']);
	});

	it('rejects GM/narrator voice and CJK leaks', () => {
		const chips = filterSuggestions([
			'GM: คุณเดินต่อไป',
			'ผู้เล่าเรื่องบรรยายต่อ',
			'ไปสืบเรื่อง 挑战 ในป่า',
			'กลับไปพักที่โรงเตี๊ยม'
		]);
		expect(chips).toEqual(['กลับไปพักที่โรงเตี๊ยม']);
	});

	it('dedupes and drops too-short/too-long entries', () => {
		const chips = filterSuggestions([
			'ไป',
			'ตามรอยเท้าเข้าป่า',
			'ตามรอยเท้าเข้าป่า',
			'x'.repeat(120)
		]);
		expect(chips).toEqual(['ตามรอยเท้าเข้าป่า']);
	});
});

describe('generateSuggestions vs the stub', () => {
	it('returns player-voice chips routed by prompt content', async () => {
		const result = await generateSuggestions({
			narration: 'สายลมหนาวพัดผ่านซุ้มประตูหิน',
			quickFacts: 'วันที่ 2 (เย็น) · หมู่บ้านท่าไม้',
			n: 3,
			baseUrl
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.chips).toHaveLength(3);
			expect(result.chips[0]).toContain('ลุงหมึก');
		}
	});
});

describe('memory + epilogue calls vs the stub', () => {
	it('consolidates a session summary', async () => {
		const result = await consolidateSessionSummary({
			existing: '',
			events: 'ผู้เล่น: สอบถามลุงหมึก\n---\nGM: เฒ่าเล่าเรื่องริบบิ้นแดง',
			baseUrl
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.text).toContain('ตะวัน');
	});

	it('writes a Thai epilogue', async () => {
		const result = await generateEpilogue({
			heroName: 'ตะวัน',
			heroClass: 'นักเวท',
			deathPlace: 'ป่าไผ่',
			day: 5,
			storySoFar: 'ผู้เล่น: ตามรอยเท้า',
			baseUrl
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.text).toContain('ประตู');
	});
});
