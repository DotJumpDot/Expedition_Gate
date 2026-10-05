/**
 * Campaign session store — a reactive mirror of the server's truth (Docs/01:
 * SQLite is the source; this rune store refreshes per turn via SSE events).
 */
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { WorldState } from '$lib/server/engine/worldstate';

/** Thrown for 4xx/5xx opens — stops fetch-event-source from retrying. */
class FatalError extends Error {}

export interface UiMessage {
	id: string;
	seq: number;
	role: 'player' | 'gm' | 'system';
	content: string;
	meta: Record<string, unknown>;
}

export type SendKind = 'free' | 'opening' | 'attack' | 'search' | 'talk' | 'flee' | 'roll';

function createSession() {
	let campaignId = $state<string | null>(null);
	let title = $state('');
	let setting = $state('');
	let state = $state<WorldState | null>(null);
	let stale = $state(false);
	let messages = $state<UiMessage[]>([]);
	let streaming = $state('');
	let resolutionLine = $state('');
	let busy = $state(false);
	let error = $state('');
	let controller: AbortController | null = null;

	let localSeq = 1_000_000;

	function reset() {
		campaignId = null;
		title = '';
		setting = '';
		state = null;
		stale = false;
		messages = [];
		streaming = '';
		resolutionLine = '';
		busy = false;
		error = '';
		controller = null;
	}

	async function load(id: string): Promise<boolean> {
		reset();
		campaignId = id;
		try {
			const res = await fetch(`/api/campaigns/${id}`, { cache: 'no-store' });
			if (!res.ok) {
				error = 'ไม่พบการผจญภัยนี้';
				return false;
			}
			const data = (await res.json()) as {
				campaign: { id: string; title: string; setting: string; stateStale: boolean };
				state: WorldState;
				messages: UiMessage[];
			};
			title = data.campaign.title;
			setting = data.campaign.setting;
			state = data.state;
			stale = data.campaign.stateStale;
			messages = data.messages;
			return true;
		} catch {
			error = 'โหลดการผจญภัยไม่สำเร็จ';
			return false;
		}
	}

	/** Send a turn; streams the GM reply into `streaming` until done/aborted. */
	async function send(kind: SendKind, text = '', stat?: string, dc?: number): Promise<void> {
		if (!campaignId || busy) return;
		const playerText = kind === 'opening' ? '（เริ่มต้นการผจญภัย）' : text.trim();
		if (kind !== 'opening' && !playerText) return;

		busy = true;
		error = '';
		streaming = '';
		resolutionLine = '';
		messages.push({
			id: `local-${localSeq++}`,
			seq: localSeq,
			role: 'player',
			content: playerText,
			meta: { kind, local: true }
		});

		controller = new AbortController();
		let settled = false;

		const finalize = (aborted: boolean) => {
			if (settled) return;
			settled = true;
			if (streaming.trim()) {
				messages.push({
					id: `local-${localSeq++}`,
					seq: localSeq,
					role: 'gm',
					content: streaming,
					meta: aborted ? { aborted: true } : {}
				});
			}
			streaming = '';
			resolutionLine = '';
			busy = false;
			controller = null;
		};

		try {
			await fetchEventSource('/api/gm/turn', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					campaignId,
					input: { kind, text: playerText, stat, dc }
				}),
				signal: controller.signal,
				openWhenHidden: true,
				async onopen(res) {
					const contentType = res.headers.get('content-type') ?? '';
					if (!res.ok || !contentType.includes('text/event-stream')) {
						const body = (await res.json().catch(() => ({}))) as { error?: string };
						throw new FatalError(body.error ?? `เชื่อมต่อผู้เล่าเรื่องไม่สำเร็จ (${res.status})`);
					}
				},
				onmessage(ev) {
					if (!ev.data) return;
					let data: {
						type: string;
						line?: string;
						text?: string;
						message?: string;
						state?: WorldState;
						stale?: boolean;
					};
					try {
						data = JSON.parse(ev.data);
					} catch {
						return;
					}
					switch (data.type) {
						case 'resolution':
							resolutionLine = data.line ?? '';
							break;
						case 'delta':
							streaming += data.text ?? '';
							break;
						case 'state':
							if (data.state) state = data.state;
							stale = data.stale ?? false;
							break;
						case 'done':
							finalize(false);
							break;
						case 'aborted':
							finalize(true);
							break;
						case 'error':
							error = data.message ?? 'เกิดข้อผิดพลาด';
							busy = false;
							break;
					}
				},
				onerror(err) {
					// No auto-retry: a half-replayed turn would corrupt the story.
					throw err;
				}
			});
		} catch (err) {
			if (err instanceof FatalError) {
				error = err.message;
			} else if (!(err instanceof DOMException && err.name === 'AbortError')) {
				error = 'ขาดการเชื่อมต่อระหว่างเล่าเรื่อง — ข้อความชุดนี้ไม่ถูกบันทึก';
			}
			finalize(controller === null);
		}
	}

	/** Stop mid-turn — server flag AND client abort (Windows lesson: both). */
	async function stop() {
		if (!campaignId) return;
		const id = campaignId;
		await fetch('/api/gm/stop', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ campaignId: id })
		}).catch(() => {});
		controller?.abort();
	}

	return {
		get campaignId() {
			return campaignId;
		},
		get title() {
			return title;
		},
		get setting() {
			return setting;
		},
		get state() {
			return state;
		},
		get stale() {
			return stale;
		},
		get messages() {
			return messages;
		},
		get streaming() {
			return streaming;
		},
		get resolutionLine() {
			return resolutionLine;
		},
		get busy() {
			return busy;
		},
		get error() {
			return error;
		},
		reset,
		load,
		send,
		stop
	};
}

export const session = createSession();
