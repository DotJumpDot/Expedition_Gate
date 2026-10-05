/**
 * Memory tiers (Docs/03). P1 ships the Window tier; session summary + chronicle
 * consolidation land in P2 — the assembly order below already reserves a slot.
 */
import type { ChatMessage } from '../llama';

export interface MemorySlice {
	/** Verbatim recent messages (chat history, sent as message array). */
	window: Array<{ role: 'player' | 'gm'; content: string }>;
	/** Chronical + session summary text block (P2 — empty string for now). */
	summaryText: string;
}

/**
 * Take the last N messages within a character budget (rolling window).
 * Rows must be ordered oldest → newest.
 */
export function buildMemory(
	rows: Array<{ role: string; content: string }>,
	opts: { maxChars?: number; maxMessages?: number } = {}
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

	return { window, summaryText: '' };
}

/** Chat history as llama messages (player → user, gm → assistant). */
export function windowToChatMessages(window: MemorySlice['window']): ChatMessage[] {
	return window.map((message) => ({
		role: message.role === 'player' ? ('user' as const) : ('assistant' as const),
		content: message.content
	}));
}
