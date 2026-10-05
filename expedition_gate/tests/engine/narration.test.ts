import { describe, expect, it } from 'vitest';
import { parseNarration } from '$lib/narration';

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
