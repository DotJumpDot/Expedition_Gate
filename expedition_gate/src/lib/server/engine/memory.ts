/**
 * Memory tiers (Docs/03). P1 ships the Window tier; session summary + chronicle
 * consolidation land in P2 — the assembly order below already reserves a slot.
 */
import type { ChatMessage } from '../llama';

export interface MemorySlice {
	/** Verbatim recent messages (chat history, sent as message array). */
	window: Array<{ role: 'player' | 'gm'; content: string }>;
	/** Chronicle + session summary text block for the system prompt (P2). */
	summaryText: string;
}

/** Consolidated layers persisted on the campaign row (rebuilt after turns). */
export interface ConsolidatedMemory {
	chronicle: string;
	sessionSummary: string;
}

export function composeMemoryText(memory: ConsolidatedMemory): string {
	const parts: string[] = [];
	if (memory.chronicle.trim()) {
		parts.push(
			`### พงศาวดารแห่งโลก (ความจำระยะยาว — ข้อเท็จจริงเหล่านี้เป็นจริงเสมอ)\n${memory.chronicle.trim()}`
		);
	}
	if (memory.sessionSummary.trim()) {
		parts.push(`### เซสชันนี้เกิดอะไรขึ้น\n${memory.sessionSummary.trim()}`);
	}
	return parts.join('\n\n');
}

/**
 * Take the last N messages within a character budget (rolling window)
 * plus the consolidated layers. Rows must be ordered oldest → newest.
 */
export function buildMemory(
	rows: Array<{ role: string; content: string }>,
	opts: {
		maxChars?: number;
		maxMessages?: number;
		consolidated?: ConsolidatedMemory;
	} = {}
): MemorySlice {
	const maxChars = opts.maxChars ?? 6000;
	const maxMessages = opts.maxMessages ?? 12;

	const window: MemorySlice['window'] = [];
	let used = 0;
	for (let i = rows.length - 1; i >= 0; i--) {
		const row = rows[i];
		if (row.role === 'system') continue;
		if (window.length >= maxMessages) break;
		if (used + row.content.length > maxChars && window.length > 0) break;
		window.unshift({ role: row.role as 'player' | 'gm', content: row.content });
		used += row.content.length;
	}

	return {
		window,
		summaryText: opts.consolidated ? composeMemoryText(opts.consolidated) : ''
	};
}

/** Chat history as llama messages (player → user, gm → assistant). */
export function windowToChatMessages(window: MemorySlice['window']): ChatMessage[] {
	return window.map((message) => ({
		role: message.role === 'player' ? ('user' as const) : ('assistant' as const),
		content: message.content
	}));
}
