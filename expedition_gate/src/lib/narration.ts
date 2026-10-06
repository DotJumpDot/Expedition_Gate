/**
 * Narration parser (client-safe) — splits GM output into dialogue / narration /
 * 📊 status blocks. Sibling-app lesson: glue regexes NEVER cross newlines, so
 * we work line-by-line inside a paragraph and never span paragraphs.
 */

export type NarrationBlock =
	| { type: 'narration'; text: string }
	| { type: 'dialogue'; speaker: string; line: string }
	| { type: 'status'; text: string };

const DIALOGUE_RE = /^(?:\[)?([^:*"“”]{1,30}?)\s*:\s*["“](.+?)["”]\s*(?:\])?$/;
const STATUS_MARK = '📊';

/** Parse one GM message into renderable blocks. */
export function parseNarration(content: string): NarrationBlock[] {
	const blocks: NarrationBlock[] = [];

	for (const paragraph of content.split(/\n{2,}/)) {
		const lines = paragraph
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		if (lines.length === 0) continue;

		let narrationBuffer: string[] = [];
		const flushNarration = () => {
			if (narrationBuffer.length) {
				blocks.push({ type: 'narration', text: narrationBuffer.join(' ') });
				narrationBuffer = [];
			}
		};

		for (let line of lines) {
			if (line.includes(STATUS_MARK)) {
				flushNarration();
				// Strip surrounding [ ... ] wrappers the model sometimes adds.
				if (line.startsWith('[') && line.endsWith(']')) {
					line = line.slice(1, -1);
				}
				blocks.push({ type: 'status', text: line.trim() });
				continue;
			}
			const match = line.match(DIALOGUE_RE);
			if (match) {
				flushNarration();
				blocks.push({ type: 'dialogue', speaker: match[1].trim(), line: match[2].trim() });
				continue;
			}
			narrationBuffer.push(line);
		}
		flushNarration();
	}

	return blocks;
}

/** Speaker display name cleanup (strip stray markdown the model sometimes adds). */
export function cleanSpeaker(speaker: string): string {
	return speaker.replace(/[*_`#]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Inline formatting (Novel's Model lineage): escape first, then map the GM's
// tiny markup vocabulary onto our own tags — the only HTML ever injected is
// produced by these replacements, never from raw model text.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** `**bold**`, `*stage direction*`, `__underline__`, and "quoted speech" spans. */
export function inlineFormat(s: string): string {
	let out = escapeHtml(s);
	out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
	out = out.replace(/\*([^*\n]+)\*/g, '<i class="stage">$1</i>');
	out = out.replace(/__([^_]+)__/g, '<u>$1</u>');
	out = out.replace(/(&quot;[^&]{1,400}&quot;|“[^”]{1,400}”)/g, '<span class="q">$1</span>');
	return out;
}

// ---------------------------------------------------------------------------
// Stable per-speaker colors (same name → same color, Novel's Model lineage).
// ---------------------------------------------------------------------------

const SPEAKER_COLORS = [
	'#8fd3ff',
	'#ffb37f',
	'#a5f0b4',
	'#e6a8ff',
	'#ffe28a',
	'#ff9e9e',
	'#9dd6ff',
	'#f2c2ff'
];

export function speakerColor(name: string): string {
	let hash = 0;
	for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
	return SPEAKER_COLORS[hash % SPEAKER_COLORS.length] ?? '#8fd3ff';
}

// ---------------------------------------------------------------------------
// 📊 status block → typed, individually colorable segments.
// ---------------------------------------------------------------------------

export type StatusKind = 'hp' | 'mana' | 'gold' | 'xp' | 'lv' | 'condition' | 'plain';

export interface StatusSegment {
	kind: StatusKind;
	text: string;
}

/** Split `HP 34/44 · มานา 10/10 · ทอง 120 · สภาพ: พิษ` into colorable segments. */
export function parseStatusSegments(text: string): StatusSegment[] {
	const cleaned = text.replace('📊', '').replace(/[[\]]/g, '').trim();
	const parts = cleaned
		.split(/[·|]/)
		.map((part) => part.trim())
		.filter(Boolean);

	const segments: StatusSegment[] = [];
	for (const part of parts) {
		if (/^HP\b|^พลังชีวิต/i.test(part)) segments.push({ kind: 'hp', text: part });
		else if (/^มานา|^MP\b/i.test(part)) segments.push({ kind: 'mana', text: part });
		else if (/ทอง|เงิน|^GP\b/i.test(part)) segments.push({ kind: 'gold', text: part });
		else if (/^XP\b|ค่าประสบการณ์/i.test(part)) segments.push({ kind: 'xp', text: part });
		else if (/^LV\b|เลเวล/i.test(part)) segments.push({ kind: 'lv', text: part });
		else if (/สภาพ|พิษ|บาดเจ็บ|เผาไหม้|เลือดไหล|มึนงง|น้ำแข็ง|กระดูกหัก/i.test(part))
			segments.push({ kind: 'condition', text: part });
		else segments.push({ kind: 'plain', text: part });
	}
	return segments.length > 0 ? segments : [{ kind: 'plain', text: cleaned }];
}

// ---------------------------------------------------------------------------
// Player-facing resolution text — friendlier than the GM-facing line the model
// obeys. Built from the persisted dice record when we have one.
// ---------------------------------------------------------------------------

export type ResolutionTone = 'good' | 'bad' | 'neutral';

export interface ResolutionView {
	text: string;
	tone: ResolutionTone;
}

interface DiceDetail {
	die?: number;
	mod?: number;
	total?: number;
	dc?: number;
	outcome?: string;
}

interface DiceRecord {
	kind?: string;
	stat?: string;
	detail?: DiceDetail;
}

const OUTCOME_TH: Record<string, { label: string; tone: ResolutionTone }> = {
	crit: { label: 'สำเร็จอย่างสมบูรณ์!', tone: 'good' },
	success: { label: 'ผ่าน!', tone: 'good' },
	fail: { label: 'ไม่ผ่าน', tone: 'bad' },
	fumble: { label: 'พลาดยับ', tone: 'bad' }
};

const STAT_TH: Record<string, string> = {
	str: 'พลัง',
	agi: 'ความว่องไว',
	dex: 'ความแม่นยำ',
	vit: 'พลังชีวิต',
	int: 'สติปัญญา',
	spi: 'จิตวิญญาณ',
	cha: 'เสน่ห์',
	luk: 'ดวง'
};

/** Instructional markers meant for the GM — never show them to the player. */
const GM_MARKER_RE = /[（(]\s*(?:ระบบทอยแล้ว|ระบบคิดแล้ว|ผลการตัดสิน)[^)]*[)]\s*:?\s*/g;

export function friendlyResolution(resolution: string, dice?: unknown[]): ResolutionView {
	const records = Array.isArray(dice) ? (dice as DiceRecord[]) : [];
	const rec = records.find(
		(r) =>
			(r.kind === 'check' || r.kind === 'death-save') &&
			r.detail &&
			typeof r.detail.die === 'number'
	);

	// Lead line the app wrote before the technical check (e.g. the แต้มดวง reroll).
	const leadMatch = resolution.split('\n')[0]?.trim() ?? '';
	const lead = GM_MARKER_RE.test(leadMatch) || leadMatch.includes('ผลการตัดสิน') ? '' : leadMatch;
	GM_MARKER_RE.lastIndex = 0;

	if (rec?.detail) {
		const { die, mod = 0, total, dc, outcome } = rec.detail;
		const verdict = OUTCOME_TH[outcome ?? ''] ?? { label: '', tone: 'neutral' as ResolutionTone };
		const statLabel = rec.stat ? (STAT_TH[rec.stat] ?? rec.stat) : '';
		let text: string;
		if (rec.kind === 'death-save') {
			text = `ทอยของรอดตาย ได้ ${die} (ต้องได้ ${dc} ขึ้นไป) → ${verdict.label}`;
		} else if (typeof total === 'number' && typeof dc === 'number') {
			const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
			text = `ทอยได้ ${die} ${modStr}${statLabel ? ` (${statLabel})` : ''} = ${total} — ต้องได้ ${dc} ขึ้นไป → ${verdict.label}`;
		} else {
			text = resolution.replace(GM_MARKER_RE, '').trim();
		}
		return {
			text: lead && lead !== text ? `${lead}\n${text}` : text,
			tone: verdict.tone
		};
	}

	return { text: resolution.replace(GM_MARKER_RE, '').trim(), tone: 'neutral' };
}
