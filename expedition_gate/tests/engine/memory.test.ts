import { describe, expect, it } from 'vitest';
import { buildMemory, composeMemoryText, windowToChatMessages } from '$lib/server/engine/memory';

describe('memory window', () => {
	it('takes the newest messages within budget', () => {
		const rows = Array.from({ length: 20 }, (_, i) => ({
			role: i % 2 === 0 ? 'player' : 'gm',
			content: `ข้อความ ${i} `.repeat(2)
		}));
		const slice = buildMemory(rows, { maxMessages: 6, maxChars: 1000 });
		expect(slice.window).toHaveLength(6);
		expect(slice.window.at(-1)?.content).toContain('ข้อความ 19');
		expect(slice.window[0]?.content).toContain('ข้อความ 14');
	});

	it('maps player→user, gm→assistant for the chat API', () => {
		const messages = windowToChatMessages([
			{ role: 'player', content: 'ทดสอบ' },
			{ role: 'gm', content: 'ตอบ' }
		]);
		expect(messages).toEqual([
			{ role: 'user', content: 'ทดสอบ' },
			{ role: 'assistant', content: 'ตอบ' }
		]);
	});
});

describe('consolidated memory composition (P2 tiers)', () => {
	it('composes chronicle + session summary into the prompt block', () => {
		const text = composeMemoryText({
			chronicle: '**ความสัมพันธ์สำคัญ:** ลุงหมึกเป็นมิตร',
			sessionSummary: 'ตะวันมาถึงหมู่บ้านและสืบเรื่องรอยเท้า'
		});
		expect(text).toContain('พงศาวดารแห่งโลก');
		expect(text).toContain('ความสัมพันธ์สำคัญ');
		expect(text).toContain('เซสชันนี้เกิดอะไรขึ้น');
	});

	it('returns empty text when nothing is consolidated yet', () => {
		expect(composeMemoryText({ chronicle: '', sessionSummary: '' })).toBe('');
	});

	it('buildMemory injects consolidated text into the slice', () => {
		const slice = buildMemory([], {
			consolidated: { chronicle: 'พงศาวดารเดิม', sessionSummary: 'สรุปเดิม' }
		});
		expect(slice.summaryText).toContain('พงศาวดารเดิม');
		expect(slice.summaryText).toContain('สรุปเดิม');
	});
});
