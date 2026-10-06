<script lang="ts">
	import { BookmarkPlus, History, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let {
		campaignId,
		onclose,
		onrestored
	}: {
		campaignId: string;
		onclose: () => void;
		onrestored: () => void;
	} = $props();

	interface Checkpoint {
		id: string;
		note: string;
		messagesUpTo: number;
		createdAt: string;
		auto: boolean;
	}

	let checkpoints = $state<Checkpoint[]>([]);
	let note = $state('');
	let saving = $state(false);
	let confirmId = $state<string | null>(null);

	async function refresh() {
		const res = await fetch(`/api/campaigns/${campaignId}/checkpoints`, { cache: 'no-store' });
		if (res.ok) {
			const data = (await res.json()) as { checkpoints: Checkpoint[] };
			checkpoints = data.checkpoints;
		}
	}
	void refresh();

	async function save() {
		saving = true;
		await fetch(`/api/campaigns/${campaignId}/checkpoints`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ note })
		});
		note = '';
		await refresh();
		saving = false;
	}

	async function restore(id: string) {
		if (confirmId !== id) {
			confirmId = id;
			setTimeout(() => (confirmId = confirmId === id ? null : confirmId), 3500);
			return;
		}
		const res = await fetch(`/api/campaigns/${campaignId}/checkpoints/${id}/restore`, {
			method: 'POST'
		});
		if (res.ok) onrestored();
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleString('th-TH', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="cp-panel msg-enter" role="dialog" aria-label="จุดบันทึก">
	<header class="flex items-center justify-between border-b border-border/60 px-4 py-3">
		<h2 class="flex items-center gap-2 text-sm font-bold">
			<History class="size-4" aria-hidden="true" />
			จุดบันทึก
		</h2>
		<Button variant="ghost" size="icon-sm" onclick={onclose}>
			<X class="size-4" aria-hidden="true" />
		</Button>
	</header>

	<div class="space-y-3 px-4 py-3">
		<div class="flex gap-2">
			<Input bind:value={note} placeholder="บันทึกตอนนี้ไว้ว่า..." class="h-9" />
			<Button size="sm" onclick={save} disabled={saving || !note.trim()}>
				<BookmarkPlus class="size-4" aria-hidden="true" />
				บันทึก
			</Button>
		</div>

		{#if checkpoints.length === 0}
			<p class="py-2 text-center text-xs text-muted-foreground">ยังไม่มีจุดบันทึก</p>
		{:else}
			<ul class="max-h-72 space-y-1.5 overflow-y-auto">
				{#each checkpoints as checkpoint (checkpoint.id)}
					<li
						class="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate text-[13px]">
								{checkpoint.note || 'จุดบันทึก'}
								{#if checkpoint.auto}
									<span class="text-[10px] text-muted-foreground">(อัตโนมัติ)</span>
								{/if}
							</p>
							<p class="text-[10px] text-muted-foreground">
								{formatTime(checkpoint.createdAt)} · เทิร์นที่ {checkpoint.messagesUpTo}
							</p>
						</div>
						<button
							type="button"
							class="restore-btn {confirmId === checkpoint.id ? 'confirm' : ''}"
							onclick={() => void restore(checkpoint.id)}
						>
							{confirmId === checkpoint.id ? 'ยืนยันย้อน?' : 'ย้อนเวลา'}
						</button>
					</li>
				{/each}
			</ul>
			<p class="text-[10px] leading-relaxed text-muted-foreground">
				การย้อนเวลาจะบันทึกสาขาปัจจุบันไว้อัตโนมัติก่อนเสมอ — ไม่มีอะไรหายไปตลอดกาล
			</p>
		{/if}
	</div>
</div>

<style>
	.cp-panel {
		position: absolute;
		top: 3rem;
		right: 1rem;
		z-index: 30;
		width: 340px;
		max-width: calc(100vw - 2rem);
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-popover);
		box-shadow: 0 18px 48px oklch(0 0 0 / 50%);
	}

	.restore-btn {
		flex-shrink: 0;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.22rem 0.7rem;
		font-size: 0.72rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out);
	}
	.restore-btn.confirm {
		border-color: color-mix(in oklch, var(--color-destructive) 55%, transparent);
		color: var(--color-destructive);
	}

	@media (hover: hover) and (pointer: fine) {
		.restore-btn:hover {
			color: var(--color-foreground);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}

	.msg-enter {
		animation: cp-rise 0.25s var(--ease-out) backwards;
	}

	@keyframes cp-rise {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.98);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.msg-enter {
			animation: none;
		}
	}
</style>
