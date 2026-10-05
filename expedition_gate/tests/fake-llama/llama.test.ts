// @vitest-environment node
// Server-side code under test: real sockets need node's undici fetch, not happy-dom's.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeLlama } from './server.mjs';
import { complete, health, stream } from '$lib/server/llama';

let server: ReturnType<typeof createFakeLlama>;
let baseUrl = '';

beforeAll(async () => {
	server = createFakeLlama();
	await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('no port');
	baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(() => {
	server.close();
});

describe('llama client against the fake stub', () => {
	it('health() reports the stub model as online', async () => {
		const result = await health(3000, baseUrl);
		expect(result).toEqual({ online: true, model: 'fake-gm-model' });
	});

	it('health() reports offline for a dead endpoint', async () => {
		const result = await health(1500, 'http://127.0.0.1:1/v1');
		expect(result.online).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it('complete() returns narration content (scenario ok)', async () => {
		const result = await complete({
			messages: [{ role: 'user', content: 'เริ่มต้นเรื่อง' }],
			maxTokens: 512,
			timeoutMs: 10_000,
			baseUrl
		});
		expect(result.finishReason).toBe('stop');
		expect(result.content).toContain('สายลมหนาว');
	});

	it('stream() yields delta events that concatenate to the full narration', async () => {
		let text = '';
		let finish: string | null = null;
		for await (const event of stream({
			messages: [{ role: 'user', content: 'เล่าต่อ' }],
			baseUrl
		})) {
			if (event.type === 'delta') text += event.text;
			if (event.type === 'finish') finish = event.reason;
		}
		expect(text).toContain('สายลมหนาว');
		expect(finish).toBe('stop');
	}, 20_000);

	it('stream() can be aborted mid-flight (stop-button path)', async () => {
		const controller = new AbortController();
		let chunks = 0;
		let sawAbort = false;
		try {
			for await (const _event of stream({
				messages: [{ role: 'user', content: 'เล่าช้า ๆ' }],
				baseUrl,
				signal: controller.signal,
				onEvent: () => {
					chunks++;
					if (chunks >= 2) controller.abort();
				}
			})) {
				// draining
			}
		} catch (err) {
			sawAbort = err instanceof Error && err.name === 'AbortError';
		}
		expect(chunks).toBeLessThanOrEqual(3);
		expect(sawAbort || chunks <= 2).toBe(true);
	}, 20_000);
});

describe('fake stub protocol shapes (raw HTTP)', () => {
	it('routes scenarios via model name fake:<scenario>', async () => {
		const res = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				model: 'fake:reasoning-burn',
				messages: [{ role: 'user', content: 'ทอยลูกเต๋า' }],
				max_tokens: 64
			})
		});
		const data = (await res.json()) as {
			choices: Array<{
				message: { content: string; reasoning_content?: string };
				finish_reason: string | null;
			}>;
		};
		expect(data.choices[0].message.content).toBe('');
		expect(data.choices[0].finish_reason).toBe('length');
		expect(data.choices[0].message.reasoning_content?.length).toBeGreaterThan(0);
	});

	it('serves /v1/models like llama-server', async () => {
		const res = await fetch(`${baseUrl}/models`);
		const data = (await res.json()) as { data: Array<{ id: string }> };
		expect(data.data[0].id).toBe('fake-gm-model');
	});
});
