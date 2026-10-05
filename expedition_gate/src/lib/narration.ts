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
