#!/usr/bin/env node
// @ts-nocheck — deliberately untyped standalone Node script (runs via plain `node`).
/**
 * Fake llama-server — an OpenAI-compatible stub for automated tests.
 * NEVER point tests at the live llama-server on 8080; use this instead
 * (Docs/01_TECH_STACK.md § Testing). Default port 8090 (nothing else on this
 * machine uses it).
 *
 * Scriptable scenarios, chosen per-request by model name (`fake:<scenario>`)
 * or server-wide via `GET /__scenario/<name>`:
 *   ok             — Thai narration fixture (default)
 *   json           — a JSON body (world-brief-shaped) for complete() calls
 *   cjk            — narration containing a CJK leak (挑战) for the retry guard
 *   reasoning-burn — all tokens land in reasoning_content, empty content,
 *                     finish_reason "length" (the Gemma starvation case)
 *   slow           — SSE chunks with human-noticeable delay (stop-button tests)
 *   empty          — empty content, finish_reason "stop"
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const THAI_NARRATION = [
	'สายลมหนาวพัดผ่านซุ้มประตูหินโบราณ เผยให้เห็นรอยแตกราวฟ้าร้อยปีที่พาดผ่านสันเขา',
	'ชาวบ้าน : "ท่านนักเดินทาง ขอร้องอย่าเข้าป่าไผ่หลังหมู่บ้านตอนกลางคืนด้วยเถอะ"',
	'เขาเงยหน้าขึ้นมองดวงจันทร์สีเลือด แล้วก้าวยาว ๆ เข้าสู่เงามืดที่รออยู่ตรงหน้า'
].join('\n\n');

const WORLD_BRIEF_JSON = JSON.stringify({
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่ล้อมรอบด้วยภูเขาหินสีดำ หมู่บ้านชาวป่าตั้งอยู่ริมลำธาร',
	situation: 'รอยเท้ายักษ์ปรากฏทุกเช้ามืดที่ชายป่า ชาวบ้านเริ่มหายตัว',
	hooks: ['ตามรอยเท้ากลับไปดูแหล่งที่มา', 'สืบคำพูดของคนเฝ้าประตูหิน', 'ช่วยลุงหมึกตามหาลูกสาว'],
	npcs: [{ name: 'ลุงหมึก', role: 'พ่อค้าของชำ' }]
});

const WORLD_STATE_JSON = JSON.stringify({
	stateV: 1,
	hero: {
		name: 'ตะวัน',
		concept: 'นักเวทผู้ถูกขับไล่',
		klass: 'นักเวท',
		level: 1,
		xp: 0,
		stats: { str: 4, agi: 6, dex: 5, vit: 5, int: 8, spi: 9, cha: 7, luk: 8 },
		hp: 40,
		maxHp: 40,
		mp: 34,
		maxMp: 34,
		conditions: [],
		equipment: { weapon: { key: 'sword', label: 'ดาบเหล็ก' } },
		inventory: [{ name: 'เปื้อน้ำ', qty: 2 }],
		gold: 120,
		luckPoints: 8
	},
	world: {
		day: 2,
		timeOfDay: 'เย็น',
		location: 'หมู่บ้านท่าไม้',
		weather: 'ฝนโปรย',
		era: '',
		sceneTag: 'village',
		flags: { เจอรอยเท้า: true },
		lore: ['รอยเท้าเดินย้อนศร']
	},
	npcs: [
		{
			id: 'npc-1',
			name: 'ลุงหมึก',
			role: 'พ่อค้า',
			disposition: 1,
			location: 'ร้านของชำ',
			status: 'มีชีวิต'
		}
	],
	quests: [{ id: 'q-1', title: 'ตามหาต้นทางรอยเท้า', status: 'active', steps: ['สืบถามชาวบ้าน'] }],
	recentEvents: ['สอบถามลุงหมึกเรื่องรอยเท้า']
});

const WORLD_HERO_JSON = JSON.stringify({
	stats: { str: 5, agi: 6, dex: 5, vit: 6, int: 8, spi: 9, cha: 7, luk: 6 },
	weapon: { key: 'sword', label: 'ดาบเหล็กโบราณ' },
	armor: { key: 'leather', label: 'เสื้อเกราะหนัง' },
	inventory: [
		{ name: 'เปื้อน้ำมนต์', qty: 2 },
		{ name: 'เชือกป่าน', qty: 1 }
	],
	gold: 120,
	background:
		'ตะวันเป็นลูกหลานของหมอผีเก่าแก่ ถูกขับไล่จากเมืองหลวงจากข้อหาฝึกเวทต้องห้าม และเดินทางมาถึงประตูหินแห่งนี้เพื่อตามหาครูเก่าของตน'
});

const DEFAULT_SCENARIOS = {
	ok: { content: THAI_NARRATION, finish: 'stop', chunkDelayMs: 5 },
	json: { content: WORLD_BRIEF_JSON, finish: 'stop', chunkDelayMs: 5 },
	hero: { content: WORLD_HERO_JSON, finish: 'stop', chunkDelayMs: 5 },
	state: { content: WORLD_STATE_JSON, finish: 'stop', chunkDelayMs: 5 },
	cjk: { content: 'ป่าไผ่เงียบสงัด 挑战 อยู่ตรงหน้า', finish: 'stop', chunkDelayMs: 5 },
	'reasoning-burn': {
		content: '',
		reasoning: 'คิดพิจารณาไตร่ตรอง'.repeat(200),
		finish: 'length',
		chunkDelayMs: 2
	},
	slow: { content: THAI_NARRATION, finish: 'stop', chunkDelayMs: 150 },
	empty: { content: '', finish: 'stop', chunkDelayMs: 5 }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build the stub server. Returns the http.Server (not listening) so tests can
 * pick an ephemeral port; the CLI entry below listens on --port (default 8090).
 */
export function createFakeLlama({ scenarios = DEFAULT_SCENARIOS } = {}) {
	let defaultScenario = 'ok';

	const resolveScenario = (body) => {
		const model = String(body?.model ?? '');
		if (model.startsWith('fake:')) {
			const name = model.slice(5);
			if (!(name in scenarios)) throw new Error(`unknown fake scenario: ${name}`);
			return name;
		}
		if (defaultScenario !== 'ok') return defaultScenario;
		// Content routing: app-level tests hit this stub with real prompts —
		// pick the JSON fixture that answers the question being asked.
		const lastUser = Array.isArray(body?.messages)
			? ([...body.messages].reverse().find((message) => message?.role === 'user')?.content ?? '')
			: '';
		if (typeof lastUser === 'string') {
			if (lastUser.includes('ระบบบันทึกสถานะเกม')) return 'state';
			if (lastUser.includes('ผู้สร้างโลก')) return 'json';
			if (lastUser.includes('ผู้สร้างตัวละคร')) return 'hero';
		}
		return defaultScenario;
	};

	const server = http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url ?? '/', 'http://127.0.0.1');

			if (req.method === 'GET' && url.pathname === '/v1/models') {
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end(
					JSON.stringify({ object: 'list', data: [{ id: 'fake-gm-model', object: 'model' }] })
				);
				return;
			}

			// Test control: set the server-wide default scenario.
			const scenarioMatch = url.pathname.match(/^\/__scenario\/([a-z0-9-]+)$/);
			if (req.method === 'GET' && scenarioMatch) {
				const name = scenarioMatch[1];
				if (!(name in scenarios)) {
					res.writeHead(404, { 'content-type': 'application/json' });
					res.end(JSON.stringify({ error: `unknown scenario: ${name}` }));
					return;
				}
				defaultScenario = name;
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end(JSON.stringify({ ok: true, scenario: name }));
				return;
			}

			if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
				const body = await readBody(req);
				const name = resolveScenario(body);
				const fx = scenarios[name];
				const stream = body?.stream === true;

				if (!stream) {
					await sleep(fx.chunkDelayMs);
					res.writeHead(200, { 'content-type': 'application/json' });
					res.end(
						JSON.stringify({
							id: 'fake-' + crypto.randomUUID(),
							object: 'chat.completion',
							choices: [
								{
									index: 0,
									message: {
										content: fx.content,
										...(fx.reasoning ? { reasoning_content: fx.reasoning } : {})
									},
									finish_reason: fx.finish
								}
							],
							usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
						})
					);
					return;
				}

				res.writeHead(200, {
					'content-type': 'text/event-stream',
					'cache-control': 'no-cache',
					connection: 'close'
				});

				const id = 'fake-' + crypto.randomUUID();
				const pieces = splitIntoChunks(fx.content || fx.reasoning || '', 48);
				for (let i = 0; i < pieces.length; i++) {
					const isLast = i === pieces.length - 1;
					const delta = fx.content ? { content: pieces[i] } : { reasoning_content: pieces[i] };
					res.write(
						`data: ${JSON.stringify({
							id,
							object: 'chat.completion.chunk',
							choices: [
								{
									index: 0,
									delta,
									...(isLast ? { finish_reason: fx.finish } : {})
								}
							]
						})}\n\n`
					);
					await sleep(fx.chunkDelayMs);
				}
				if (pieces.length === 0) {
					// empty-content scenario: single finish chunk
					res.write(
						`data: ${JSON.stringify({
							id,
							object: 'chat.completion.chunk',
							choices: [{ index: 0, delta: {}, finish_reason: fx.finish }]
						})}\n\n`
					);
				}
				res.write('data: [DONE]\n\n');
				res.end();
				return;
			}

			res.writeHead(404, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ error: { message: `not found: ${req.method} ${url.pathname}` } }));
		} catch (err) {
			res.writeHead(500, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ error: { message: String(err?.message ?? err) } }));
		}
	});

	server.setDefaultScenario = (name) => {
		defaultScenario = name;
	};
	return server;
}

function readBody(req) {
	return new Promise((resolveBody, reject) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => {
			try {
				resolveBody(data ? JSON.parse(data) : {});
			} catch (err) {
				reject(err);
			}
		});
		req.on('error', reject);
	});
}

/** Split text into grapheme-ish chunks, never cutting inside a Thai cluster rudely. */
function splitIntoChunks(text, size) {
	const chunks = [];
	for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
	return chunks;
}

// CLI entry: `node tests/fake-llama/server.mjs [--port 8090]`
const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) {
	const portFlag = process.argv.indexOf('--port');
	const port = portFlag !== -1 ? Number(process.argv[portFlag + 1]) : 8090;
	const server = createFakeLlama();
	server.listen(port, '127.0.0.1', () => {
		console.log(`fake-llama listening on http://127.0.0.1:${port}/v1 (scenario: ok)`);
	});
}
