#!/usr/bin/env node
/**
 * P1 end-to-end smoke against the running dev server (LLAMA_URL must point at
 * the fake-llama stub). Exercises: brief → hero proposal → create → SSE turn
 * (attack) → persistence → state update → stop mid-turn → resume payload.
 *
 * Usage: node tests/e2e-smoke.mjs [baseUrl=http://localhost:5173]
 */
const BASE = process.argv[2] ?? 'http://localhost:5173';

let failures = 0;
function assert(condition, label) {
	if (condition) {
		console.log(`  ✓ ${label}`);
	} else {
		failures++;
		console.error(`  ✗ FAIL: ${label}`);
	}
}

async function post(path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	return { status: res.status, data: await res.json() };
}

console.log(`E2E smoke → ${BASE}`);

// 1. world brief
const briefRes = await post('/api/campaigns/brief', {
	setting: 'thai_legend',
	tone: ['มืดมน', 'ผจญภัย']
});
assert(briefRes.status === 200 && briefRes.data.brief?.name, 'world brief generated');
const brief = briefRes.data.brief;

// 2. hero proposal
const heroRes = await post('/api/campaigns/hero-proposal', {
	brief,
	name: 'ตะวัน',
	concept: 'นักเวทผู้ถูกขับไล่',
	klass: 'นักเวท'
});
assert(heroRes.status === 200 && heroRes.data.proposal?.stats, 'hero proposal generated');
const proposal = heroRes.data.proposal;
const statTotal = Object.values(proposal.stats).reduce((a, b) => a + b, 0);
assert(statTotal === 52, `hero stats sum to 52 (got ${statTotal})`);

// 3. create campaign
const createRes = await post('/api/campaigns', {
	setting: 'thai_legend',
	tone: ['มืดมน'],
	brief,
	heroName: 'ตะวัน',
	heroConcept: 'นักเวทผู้ถูกขับไล่',
	heroClass: 'นักเวท',
	proposal
});
assert(createRes.status === 201 && createRes.data.id, 'campaign created');
const campaignId = createRes.data.id;

// 4. list contains it
const listRes = await fetch(`${BASE}/api/campaigns`).then((res) => res.json());
assert(
	listRes.campaigns?.some(
		(campaign) => campaign.id === campaignId && campaign.heroName === 'ตะวัน'
	),
	'gate list shows the campaign with hero name'
);

// 5. opening turn (SSE)
async function playTurn(input) {
	const res = await fetch(`${BASE}/api/gm/turn`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ campaignId, input })
	});
	if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
		return { error: await res.json() };
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	const events = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let sep;
		while ((sep = buffer.indexOf('\n\n')) !== -1) {
			const raw = buffer.slice(0, sep);
			buffer = buffer.slice(sep + 2);
			const line = raw.split('\n').find((l) => l.startsWith('data:'));
			if (line) events.push(JSON.parse(line.slice(5).trim()));
		}
	}
	return { events };
}

const opening = await playTurn({ kind: 'opening', text: '' });
const openingText = (opening.events ?? [])
	.filter((e) => e.type === 'delta')
	.map((e) => e.text)
	.join('');
assert(openingText.includes('สายลมหนาว'), 'opening turn streamed Thai narration');
assert(
	opening.events.some((e) => e.type === 'state' && e.state?.hero?.name),
	'state event arrived after opening'
);
assert(opening.events.at(-1)?.type === 'done', 'opening turn completed');

// 6. attack turn with dice resolution
const attack = await playTurn({ kind: 'attack', text: 'ผมจะโจมตีด้วยดาบ!' });
const resolution = attack.events.find((e) => e.type === 'resolution');
assert(resolution?.line?.includes('ผลการตัดสิน'), 'attack turn emitted a dice resolution line');
assert(resolution.line.includes('d20('), 'resolution line carries the rolled d20');
const attackState = attack.events.find((e) => e.type === 'state');
assert(attackState?.state?.hero, 'state updated after attack turn');

// 7. persistence: reload the campaign
const reload = await fetch(`${BASE}/api/campaigns/${campaignId}`).then((res) => res.json());
const playerMsgs = reload.messages.filter((m) => m.role === 'player');
const gmMsgs = reload.messages.filter((m) => m.role === 'gm');
assert(playerMsgs.length === 2, `player messages persisted (${playerMsgs.length})`);
assert(gmMsgs.length === 2, `gm messages persisted (${gmMsgs.length})`);
assert(
	playerMsgs.some((m) => m.meta?.dice?.length > 0),
	'dice results recorded in message meta (audit trail)'
);
assert(reload.state.hero.name, 'world state persisted');

// 8. game page renders
const page = await fetch(`${BASE}/campaign/${campaignId}`);
const html = await page.text();
assert(
	page.status === 200 && html.includes('ประตูนักสำรวจ'),
	'game screen renders for the campaign'
);

// 9. stop mid-turn: slow scenario → abort → aborted event, GM turn NOT saved
const stubPort = new URL(process.env.STUB_URL ?? 'http://127.0.0.1:8090').port;
await fetch(`http://127.0.0.1:${stubPort}/__scenario/slow`).then((r) => r.json());
const messagesBefore = reload.messages.length;
await (async () => {
	const res = await fetch(`${BASE}/api/gm/turn`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			campaignId,
			input: { kind: 'free', text: 'เดินลึกเข้าไปในป่าอีกหน่อย' }
		})
	});
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	const events = [];
	let pumpDone;
	const pumpPromise = new Promise((resolve) => (pumpDone = resolve));
	void (async () => {
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let sep;
				while ((sep = buffer.indexOf('\n\n')) !== -1) {
					const raw = buffer.slice(0, sep);
					buffer = buffer.slice(sep + 2);
					const line = raw.split('\n').find((l) => l.startsWith('data:'));
					if (line) events.push(JSON.parse(line.slice(5).trim()));
				}
			}
		} finally {
			pumpDone();
		}
	})();

	// Wait for the first narration chunk, then stop (server flag + client abort).
	await new Promise((resolve) => {
		const poll = setInterval(() => {
			if (events.some((e) => e.type === 'delta')) {
				clearInterval(poll);
				resolve();
			}
		}, 20);
	});
	await post('/api/gm/stop', { campaignId });
	await reader.cancel().catch(() => {});
	await pumpPromise;
})();
await fetch(`http://127.0.0.1:${stubPort}/__scenario/ok`).then((r) => r.json());

const afterStop = await fetch(`${BASE}/api/campaigns/${campaignId}`).then((r) => r.json());
const gmAfterStop = afterStop.messages.filter((m) => m.role === 'gm').length;
assert(
	gmAfterStop === gmMsgs.length,
	`aborted GM turn not saved (${gmAfterStop} gm msgs, was ${gmMsgs.length})`
);
assert(
	afterStop.messages.length === messagesBefore + 1,
	'player message kept, GM message discarded (only completed turns save)'
);

// 10. cleanup: delete the smoke campaign
const deleteRes = await fetch(`${BASE}/api/campaigns/${campaignId}`, { method: 'DELETE' });
assert(deleteRes.ok, 'campaign deleted (cleanup)');

console.log(failures === 0 ? '\nE2E SMOKE PASSED' : `\nE2E SMOKE FAILED (${failures} failures)`);
process.exit(failures === 0 ? 0 : 1);
