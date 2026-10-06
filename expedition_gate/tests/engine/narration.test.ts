import { describe, expect, it } from 'vitest';
import {
	parseNarration,
	inlineFormat,
	speakerColor,
	parseStatusSegments,
	friendlyResolution
} from '$lib/narration';

describe('inlineFormat (escape first, then map our tiny markup)', () => {
	it('renders **bold**, *stage*, __underline__, and quoted spans', () => {
		const html = inlineFormat('มัน**ใหญ่มาก** *เสียงแผ่วลง* __สำคัญ__ แล้วเขาพูดว่า "รีบมา"');
		expect(html).toContain('<b>ใหญ่มาก</b>');
		expect(html).toContain('<i class="stage">เสียงแผ่วลง</i>');
		expect(html).toContain('<u>สำคัญ</u>');
		expect(html).toContain('<span class="q">');
	});

	it('escapes raw HTML before mapping — never injects model markup as tags', () => {
		const html = inlineFormat('<script>alert(1)</script> **ข้อความ**');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('<b>ข้อความ</b>');
	});

	it('keeps unmarked prose untouched (no stray tags)', () => {
		expect(inlineFormat('ร้อยแก้วธรรมดา')).toBe('ร้อยแก้วธรรมดา');
	});
});

describe('speakerColor (stable per-speaker)', () => {
	it('same name → same color, different names usually differ', () => {
		expect(speakerColor('หลวงตาบุญ')).toBe(speakerColor('หลวงตาบุญ'));
		const colors = new Set(['หลวงตาบุญ', 'พรานคำแปง', 'แสนคำ', 'ยักษ์'].map(speakerColor));
		expect(colors.size).toBeGreaterThan(1);
	});
});

describe('parseStatusSegments (📊 → colorable parts)', () => {
	it('types HP / มานา / ทอง / สภาพ segments', () => {
		const segments = parseStatusSegments('📊 HP 34/44 · มานา 10/10 · ทอง 120 · สภาพ: พิษ');
		expect(segments).toEqual([
			{ kind: 'hp', text: 'HP 34/44' },
			{ kind: 'mana', text: 'มานา 10/10' },
			{ kind: 'gold', text: 'ทอง 120' },
			{ kind: 'condition', text: 'สภาพ: พิษ' }
		]);
	});

	it('unknown segments fall back to plain', () => {
		expect(parseStatusSegments('📊 อารมณ์: โกรธ')).toEqual([
			{ kind: 'plain', text: 'อารมณ์: โกรธ' }
		]);
	});
});

describe('friendlyResolution (player-facing dice line)', () => {
	const checkRecord = [
		{ kind: 'check', stat: 'spi', detail: { die: 6, mod: 2, total: 8, dc: 15, outcome: 'fail' } }
	];

	it('builds a friendly line from the dice record', () => {
		const view = friendlyResolution(
			'ผลการตัดสิน (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(6) + SPI(+2) = 8 vs DC 15 → ไม่สำเร็จ',
			checkRecord
		);
		expect(view.text).toContain('ทอยได้ 6 +2 (จิตวิญญาณ) = 8');
		expect(view.text).toContain('ต้องได้ 15 ขึ้นไป');
		expect(view.text).toContain('ไม่ผ่าน');
		expect(view.tone).toBe('bad');
		expect(view.text).not.toContain('ระบบทอยแล้ว');
	});

	it('marks success green-side', () => {
		const view = friendlyResolution('ผลการตัดสิน (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(14) = 16', [
			{
				kind: 'check',
				stat: 'agi',
				detail: { die: 14, mod: 2, total: 16, dc: 12, outcome: 'success' }
			}
		]);
		expect(view.tone).toBe('good');
	});

	it('strips GM-only markers when there is no dice record', () => {
		const view = friendlyResolution('ใช้ไอเทม (ระบบคิดแล้ว): น้ำมนต์ → ฟื้นพลังชีวิต 9');
		expect(view.text).toBe('ใช้ไอเทม น้ำมนต์ → ฟื้นพลังชีวิต 9');
		expect(view.tone).toBe('neutral');
	});

	it('keeps the app-written lead line of a reroll and drops the technical tail', () => {
		const view = friendlyResolution(
			'ใช้แต้มดวง 1 แต้ม — โชคพลิกกลับมา ทอยเช็คใหม่\nผลการตัดสิน (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(18) + SPI(+2) = 20 vs DC 15 → สำเร็จ',
			[
				{
					kind: 'check',
					stat: 'spi',
					detail: { die: 18, mod: 2, total: 20, dc: 15, outcome: 'success' }
				}
			]
		);
		expect(view.text).toContain('ใช้แต้มดวง 1 แต้ม');
		expect(view.text).toContain('ทอยได้ 18 +2 (จิตวิญญาณ) = 20');
		expect(view.tone).toBe('good');
	});

	it('death-save records get their own friendly wording', () => {
		const view = friendlyResolution(
			'เช็คของรอดตาย (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(4) vs 10 → พลาด',
			[{ kind: 'death-save', detail: { die: 4, mod: 0, total: 4, dc: 10, outcome: 'fail' } }]
		);
		expect(view.text).toContain('ทอยของรอดตาย ได้ 4');
		expect(view.tone).toBe('bad');
	});
});

describe('parseNarration (dialogue `ชื่อ : "..."` / narration / 📊 status)', () => {
	it('splits dialogue lines from narration paragraphs', () => {
		const blocks = parseNarration(
			'สายลมพัดผ่านหน้าผา\n\nหมอผีแก่ : "รอยนี้มันเดินย้อนศร"\nเสียงเฒ่าแผ่วเบาลงจนเกือบเป็นกระซิบ\n\nคุณเงยหน้ามองดวงจันทร์'
		);
		expect(blocks).toEqual([
			{ type: 'narration', text: 'สายลมพัดผ่านหน้าผา' },
			{ type: 'dialogue', speaker: 'หมอผีแก่', line: 'รอยนี้มันเดินย้อนศร' },
			{ type: 'narration', text: 'เสียงเฒ่าแผ่วเบาลงจนเกือบเป็นกระซิบ' },
			{ type: 'narration', text: 'คุณเงยหน้ามองดวงจันทร์' }
		]);
	});

	it('recognizes the status block and strips its [ ] wrapper', () => {
		const blocks = parseNarration('เขาฟันเข้าเต็มแรง\n\n[📊 HP 34/44 · มานา 10/10 · ทอง 120]');
		expect(blocks.at(-1)).toEqual({
			type: 'status',
			text: '📊 HP 34/44 · มานา 10/10 · ทอง 120'
		});
	});

	it('handles curly quotes from the model', () => {
		const blocks = parseNarration('ลุงหมึก : “ท่านมาจากไหน”');
		expect(blocks[0]).toEqual({ type: 'dialogue', speaker: 'ลุงหมึก', line: 'ท่านมาจากไหน' });
	});

	it('never lets dialogue detection cross a newline (multi-line stays narration)', () => {
		const blocks = parseNarration('บรรยาย : ไม่ใช่บทพูดจริง\nเพราะไม่มีเครื่องหมายคำพูดครบ');
		expect(blocks).toHaveLength(1);
		expect(blocks[0].type).toBe('narration');
	});

	it('ignores colon-lines that are clearly not dialogue (speaker too long or has colons)', () => {
		const blocks = parseNarration(
			'ผลการตัดสิน (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(14) + DEX(+1) = 15 vs DC 15 → สำเร็จ'
		);
		expect(blocks[0].type).toBe('narration');
	});
});
