import type { RequestHandler } from './$types';
import {
	appendMessage,
	getCampaign,
	historyWindow,
	maybeConsolidate,
	parseBrief,
	parseState,
	saveGmTurn
} from '$lib/server/engine/campaigns';
import { buildGmMessages, updateWorldState } from '$lib/server/engine/gm';
import { mulberry32 } from '$lib/server/engine/rules';
import { resolveTurn, type TurnInput } from '$lib/server/engine/turn';
import { finishTurn, isTurnRunning, registerTurn } from '$lib/server/engine/turnRuntime';
import { complete, resolveLlamaBaseUrl, stream } from '$lib/server/llama';
import { isHeroDead, mergeConsumed, type WorldState } from '$lib/game/worldstate';
import { LENGTH_TOKENS, LENGTH_HINTS, type NarrationLength } from '$lib/stores/settings.svelte';

/** CJK leak detector (Docs/04 #6) — Han/CJK ideographs in Thai prose. */
const CJK_RE = /[\u2e80-\u2eff\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * POST /api/gm/turn — the turn loop (Docs/02):
 * player input → app resolves mechanics → GM SSE stream → save → state update.
 *
 * SSE protocol (one JSON object per event):
 *   {type:'resolution', line}    dice facts, before the narration starts
 *   {type:'delta', text}         narration chunks
 *   {type:'replace', text}       CJK-rewrite replaced the whole narration
 *   {type:'state', state, stale} fresh world state after the turn
 *   {type:'done', cjkLeak?, ended?} turn complete and saved
 *   {type:'aborted'}             stopped mid-stream — nothing saved (player msg kept)
 *   {type:'error', message}      upstream/timeout failure
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		campaignId?: string;
		input?: TurnInput;
		baseUrl?: string;
		narrationLength?: NarrationLength;
		extrasOff?: boolean;
		gmOverride?: string;
	};
	const campaignId = body.campaignId ?? '';
	const input: TurnInput = body.input ?? { kind: 'free', text: '' };

	if (!campaignId) return jsonError(400, 'ไม่มี campaignId');

	// Settings: client may override the endpoint (local/LAN only — enforced).
	let baseUrl: string;
	try {
		baseUrl = resolveLlamaBaseUrl(body.baseUrl);
	} catch (err) {
		return jsonError(400, err instanceof Error ? err.message : 'GM URL ไม่ถูกต้อง');
	}
	const length = (body.narrationLength ?? 'medium') satisfies NarrationLength;

	const row = getCampaign(campaignId);
	if (!row) return jsonError(404, 'ไม่พบการผจญภัยนี้');
	if (row.ended) return jsonError(409, 'การผจญภัยนี้จบลงแล้ว');
	// One live GM turn per campaign — a second concurrent POST would collide on
	// the message seq unique index mid-stream.
	if (isTurnRunning(campaignId)) return jsonError(409, 'เทิร์นก่อนหน้ายังเล่นไม่จบ');

	const brief = parseBrief(row.worldBrief);
	const state = parseState(row.stateJson);
	if (!brief || !state)
		return jsonError(500, 'โลกหรือสถานะเสียหาย ติดต่อผู้ดูแล (หรือเริ่มโลกใหม่)');

	// The app does the math: dice rolled server-side, seeded per turn.
	const rng = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]);
	const resolved = resolveTurn(input, state, rng);

	const playerText =
		input.kind === 'opening' ? '（เริ่มต้นการผจญภัย）' : input.text.trim().slice(0, 2000);

	const playerSeq = appendMessage({
		campaignId,
		role: 'player',
		content: playerText,
		meta: {
			kind: input.kind,
			...(resolved.resolutionLine ? { resolution: resolved.resolutionLine } : {}),
			...(resolved.rolls ? { dice: resolved.rolls } : {})
		}
	});

	const gmMessages = buildGmMessages({
		brief,
		state,
		history: historyWindow(campaignId, 14).filter((message) => message.seq !== playerSeq),
		memory: { chronicle: row.chronicle, sessionSummary: row.sessionSummary },
		resolutionLine: resolved.resolutionLine,
		playerInput: playerText,
		opening: input.kind === 'opening',
		lengthHint: LENGTH_HINTS[length],
		extrasOff: body.extrasOff === true,
		gmOverride: body.gmOverride?.slice(0, 2000)
	});

	// The tracker copies `current`; app-owned death-save markers ride along and
	// are re-applied over its output (app wins for its own markers).
	const current: WorldState = structuredClone(state);
	let trackerState = current;
	if (resolved.appConditions) {
		trackerState = {
			...trackerState,
			hero: { ...trackerState.hero, conditions: resolved.appConditions }
		};
	}

	const turn = registerTurn(campaignId);
	const encoder = new TextEncoder();
	let narration = '';
	let cjkLeak = false;

	const bodyStream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};

			try {
				if (resolved.resolutionLine) send({ type: 'resolution', line: resolved.resolutionLine });

				for await (const event of stream({
					messages: gmMessages,
					temperature: 0.85,
					maxTokens: LENGTH_TOKENS[length] ?? 4096,
					signal: turn.controller.signal,
					baseUrl
				})) {
					if (turn.aborted || request.signal.aborted) break;
					if (event.type === 'delta') {
						narration += event.text;
						send({ type: 'delta', text: event.text });
					}
				}

				// Stopped mid-stream (either side): the turn is NOT saved — only
				// completed turns persist (sibling-app rule).
				if (turn.aborted || request.signal.aborted) {
					send({ type: 'aborted' });
					return;
				}
				if (!narration.trim()) {
					send({ type: 'error', message: 'ผู้เล่าเรื่องไม่ตอบกลับ (ลองอีกครั้ง)' });
					return;
				}

				// CJK leak guard (Docs/04 #6): one silent Thai-only rewrite, then keep + flag.
				if (CJK_RE.test(narration)) {
					try {
						const rewrite = await complete({
							messages: [
								...gmMessages,
								{
									role: 'user',
									content:
										'คำตอบก่อนหน้ามีอักษรจีนปนอยู่ เขียนใหม่ทั้งก้อนเป็นภาษาไทยล้วน (ยกเว้นชื่อเฉพาะและ HP/MP/LV) คงเนื้อเรื่อง บทพูด และความยาวเดิมไว้ — ห้ามมีอักษรจีนเด็ดขาด ตอบเป็นร้อยแก้วเท่านั้น'
								}
							],
							temperature: 0.6,
							maxTokens: LENGTH_TOKENS[length] ?? 4096,
							timeoutMs: 120_000,
							baseUrl
						});
						if (rewrite.content.trim() && !CJK_RE.test(rewrite.content)) {
							narration = rewrite.content.trim();
							// The client already streamed the leaky text — replace it wholesale.
							send({ type: 'replace', text: narration });
						}
					} catch {
						// rewrite is best-effort; leak flag below covers the failure
					}
					cjkLeak = CJK_RE.test(narration);
				}

				// State update after a completed turn — zod + retry inside; on
				// failure we keep the tracker-input state and flag it stale.
				let next: WorldState | null = null;
				let stale = true;
				const updated = await updateWorldState({
					current: trackerState,
					playerInput: playerText,
					narration,
					appMath: resolved.appMath,
					baseUrl
				});
				if (updated.ok) {
					next = updated.state;
					stale = false;
				}
				// Authoritative merge #2: app math + the app's death-save markers
				// + consumed items survive whatever the tracker did (idempotent
				// absolute values — app wins, Docs/03).
				const fallback: WorldState = next ?? trackerState;
				const finalState: WorldState = {
					...fallback,
					hero: {
						...fallback.hero,
						...resolved.appMath,
						...(resolved.appConditions ? { conditions: resolved.appConditions } : {}),
						...(resolved.consume
							? {
									inventory: mergeConsumed(
										state.hero.inventory,
										fallback.hero.inventory,
										resolved.consume.name
									)
								}
							: {})
					}
				};

				const endedNow = isHeroDead(finalState.hero) ? 'dead' : null;
				saveGmTurn({
					campaignId,
					content: narration,
					state: finalState,
					stateStale: stale,
					extraMeta: cjkLeak ? { cjkLeak: true } : undefined
				});
				send({ type: 'state', state: finalState, stale });
				send({ type: 'done', cjkLeak, ...(endedNow ? { ended: endedNow } : {}) });

				// Memory consolidation (every 8/20 turns) — background-grade:
				// failure keeps the old memory and never breaks the turn.
				void maybeConsolidate(campaignId, baseUrl).catch(() => {});
			} catch (err) {
				send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
			} finally {
				finishTurn(campaignId);
				controller.close();
			}
		},
		cancel() {
			// Client vanished: free the llama-server slot immediately.
			turn.controller.abort();
			finishTurn(campaignId);
		}
	});

	return new Response(bodyStream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'close'
		}
	});
};

function jsonError(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}
