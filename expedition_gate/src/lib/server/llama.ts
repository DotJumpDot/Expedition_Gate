/**
 * The ONE client for the local llama-server (OpenAI-compatible API).
 * Every LLM call in the app goes through this file — no scattered URLs.
 *
 * Default endpoint: http://127.0.0.1:8080/v1 (override with LLAMA_URL in .env).
 * Never cloud. Story content never leaves the machine.
 */
import { LLAMA_URL } from '$app/env/private';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface LlamaHealth {
	online: boolean;
	model?: string;
	error?: string;
}

export interface CompleteOptions {
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	/** Abort in-flight generation (used by the stop feature). */
	signal?: AbortSignal;
	/** Hard timeout in ms — background calls must never hang (Windows lesson). */
	timeoutMs?: number;
	/** Endpoint override for tests (defaults to LLAMA_URL). */
	baseUrl?: string;
}

export interface CompleteResult {
	content: string;
	reasoning: string;
	finishReason: string | null;
}

export interface StreamOptions extends CompleteOptions {
	/** Called after each parsed SSE event; return false to stop early. */
	onEvent?: (event: StreamEvent) => boolean | void;
}

export type StreamEvent =
	| { type: 'delta'; text: string }
	| { type: 'reasoning'; text: string }
	| { type: 'finish'; reason: string | null };

/** Base URL of the llama-server OpenAI-compatible API, without trailing slash. */
export function llamaUrl(): string {
	return LLAMA_URL.replace(/\/+$/, '');
}

function timeoutSignal(timeoutMs?: number, external?: AbortSignal): AbortSignal | undefined {
	if (!timeoutMs && !external) return undefined;
	const signals: AbortSignal[] = [];
	if (timeoutMs) signals.push(AbortSignal.timeout(timeoutMs));
	if (external) signals.push(external);
	return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
}

async function postChat(body: Record<string, unknown>, base: string, signal?: AbortSignal) {
	const res = await fetch(`${base}/chat/completions`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ...body, stream: body.stream ?? false }),
		signal,
		cache: 'no-store'
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`llama-server ${res.status}: ${text.slice(0, 300)}`);
	}
	return res;
}

/** Is the GM model up? Short timeout — this backs the status chip. */
export async function health(timeoutMs = 3000, baseUrl?: string): Promise<LlamaHealth> {
	try {
		const res = await fetch(`${baseUrl ?? llamaUrl()}/models`, {
			signal: timeoutSignal(timeoutMs),
			cache: 'no-store'
		});
		if (!res.ok) return { online: false, error: `HTTP ${res.status}` };
		const data = (await res.json()) as { data?: Array<{ id?: string }> };
		const model = data.data?.[0]?.id;
		return model ? { online: true, model } : { online: true };
	} catch (err) {
		return { online: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/** Non-streaming call — for JSON-mode background tasks (world brief, state updates). */
export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
	const res = await postChat(
		{
			messages: opts.messages,
			temperature: opts.temperature ?? 0.3,
			max_tokens: opts.maxTokens ?? 2048
		},
		opts.baseUrl ?? llamaUrl(),
		timeoutSignal(opts.timeoutMs, opts.signal)
	);
	const data = (await res.json()) as {
		choices?: Array<{
			message?: { content?: string | null; reasoning_content?: string | null };
			finish_reason?: string | null;
		}>;
	};
	const choice = data.choices?.[0];
	return {
		content: choice?.message?.content ?? '',
		reasoning: choice?.message?.reasoning_content ?? '',
		finishReason: choice?.finish_reason ?? null
	};
}

/** Streaming chat — yields parsed deltas from the SSE stream. */
export async function* stream(opts: StreamOptions): AsyncGenerator<StreamEvent> {
	const res = await postChat(
		{
			messages: opts.messages,
			temperature: opts.temperature ?? 0.8,
			max_tokens: opts.maxTokens ?? 4096,
			stream: true
		},
		opts.baseUrl ?? llamaUrl(),
		timeoutSignal(opts.timeoutMs, opts.signal)
	);
	if (!res.body) throw new Error('llama-server returned no stream body');

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let stopped = false;

	try {
		while (!stopped) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			// SSE events are separated by a blank line; never split mid-chunk.
			let sep: number;
			while ((sep = buffer.indexOf('\n\n')) !== -1) {
				const rawEvent = buffer.slice(0, sep);
				buffer = buffer.slice(sep + 2);

				for (const line of rawEvent.split('\n')) {
					if (!line.startsWith('data:')) continue;
					const payload = line.slice(5).trim();
					if (!payload || payload === '[DONE]') continue;

					let chunk: {
						choices?: Array<{
							delta?: { content?: string | null; reasoning_content?: string | null };
							finish_reason?: string | null;
						}>;
					};
					try {
						chunk = JSON.parse(payload);
					} catch {
						continue; // tolerate malformed keep-alive lines
					}

					const choice = chunk.choices?.[0];
					if (choice?.delta?.reasoning_content) {
						const event: StreamEvent = { type: 'reasoning', text: choice.delta.reasoning_content };
						if (opts.onEvent?.(event) === false) stopped = true;
						yield event;
					}
					if (choice?.delta?.content) {
						const event: StreamEvent = { type: 'delta', text: choice.delta.content };
						if (opts.onEvent?.(event) === false) stopped = true;
						yield event;
					}
					if (choice?.finish_reason) {
						const event: StreamEvent = { type: 'finish', reason: choice.finish_reason };
						if (opts.onEvent?.(event) === false) stopped = true;
						yield event;
					}
				}
			}
		}
	} finally {
		// Client aborted or early-stop: drop the upstream connection so
		// llama-server frees the slot (Windows buffer-drain lesson).
		reader.cancel().catch(() => {});
	}
}
