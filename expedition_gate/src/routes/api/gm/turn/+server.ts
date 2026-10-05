import type { RequestHandler } from './$types';
import {
	appendMessage,
	getCampaign,
	historyWindow,
	parseBrief,
	parseState,
	saveGmTurn
} from '$lib/server/engine/campaigns';
import { buildGmMessages, updateWorldState } from '$lib/server/engine/gm';
import { mulberry32 } from '$lib/server/engine/rules';
import { resolveTurn, type TurnInput } from '$lib/server/engine/turn';
import { finishTurn, registerTurn } from '$lib/server/engine/turnRuntime';
import { stream } from '$lib/server/llama';

/**
 * POST /api/gm/turn — the turn loop (Docs/02):
 * player input → app resolves mechanics → GM SSE stream → save → state update.
 *
 * SSE protocol (one JSON object per event):
 *   {type:'resolution', line}   dice facts, before the narration starts
 *   {type:'delta', text}        narration chunks
 *   {type:'state', state, stale} fresh world state after the turn
 *   {type:'done'}               turn complete and saved
 *   {type:'aborted'}            stopped mid-stream — nothing saved (player msg kept)
 *   {type:'error', message}     upstream/timeout failure
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { campaignId?: string; input?: TurnInput };
	const campaignId = body.campaignId ?? '';
	const input: TurnInput = body.input ?? { kind: 'free', text: '' };

	if (!campaignId) return jsonError(400, 'ไม่มี campaignId');
	const row = getCampaign(campaignId);
	if (!row) return jsonError(404, 'ไม่พบการผจญภัยนี้');
	if (row.ended) return jsonError(409, 'การผจญภัยนี้จบลงแล้ว');

	const brief = parseBrief(row.worldBrief);
	const state = parseState(row.stateJson);
	if (!brief || !state)
		return jsonError(500, 'โลกหรือสถานะเสียหาย ติดต่อผู้ดูแล (หรือเริ่มโลกใหม่)');

	// The app does the math: dice rolled server-side, seeded per turn.
	const rng = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]);
	const resolved = resolveTurn(input, state, rng);

	const playerText =
		input.kind === 'opening' ? '（เริ่มต้นการผจญภัย）' : input.text.trim().slice(0, 2000);

	appendMessage({
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
		history: historyWindow(campaignId, 14).filter((message) => message.content !== playerText),
		resolutionLine: resolved.resolutionLine,
		playerInput: playerText,
		opening: input.kind === 'opening'
	});

	const turn = registerTurn(campaignId);
	const encoder = new TextEncoder();
	let narration = '';

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
					maxTokens: 4096,
					signal: turn.controller.signal
				})) {
					if (turn.aborted || request.signal.aborted) break;
					if (event.type === 'delta') {
						narration += event.text;
						send({ type: 'delta', text: event.text });
					}
				}

				if ((turn.aborted || request.signal.aborted) && !narration.trimEnd().endsWith('…')) {
					send({ type: 'aborted' });
					return;
				}
				if (!narration.trim()) {
					send({ type: 'error', message: 'ผู้เล่าเรื่องไม่ตอบกลับ (ลองอีกครั้ง)' });
					return;
				}

				// State update after a completed turn — zod + retry inside; on
				// failure we keep the previous state and flag it stale.
				let next: ReturnType<typeof parseState> = null;
				let stale = true;
				const updated = await updateWorldState({
					current: state,
					playerInput: playerText,
					narration,
					appMath: resolved.appMath
				});
				if (updated.ok) {
					next = updated.state;
					stale = false;
				}

				saveGmTurn({ campaignId, content: narration, state: next ?? state, stateStale: stale });
				if (next) send({ type: 'state', state: next, stale });
				send({ type: 'done' });
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
