<script lang="ts">
	import { Dices, Send, Square } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { STAT_KEYS, STAT_LABELS_TH, type StatKey } from '$lib/game/rules';
	import { clickOutside } from '$lib/actions/clickOutside';
	import type { SendKind } from '$lib/stores/campaign.svelte';

	let {
		busy,
		onsend,
		onstop
	}: {
		busy: boolean;
		onsend: (kind: SendKind, text: string, stat?: StatKey, dc?: number) => void;
		onstop: () => void;
	} = $props();

	let text = $state('');
	let diceOpen = $state(false);
	let diceStat = $state<StatKey>('spi');
	let diceDc = $state(15);
	let diceRolling = $state(false);

	const DC_OPTIONS = [
		{ value: 8, label: 'ง่ายมาก' },
		{ value: 12, label: 'ง่าย' },
		{ value: 15, label: 'ปกติ' },
		{ value: 18, label: 'ยาก' },
		{ value: 22, label: 'แทบเป็นไปไม่ได้' }
	];

	const quickActions: Array<{ kind: SendKind; icon: string; label: string; text: string }> = [
		{ kind: 'attack', icon: '⚔️', label: 'โจมตี', text: 'โจมตีด้วยอาวุธที่ถืออยู่!' },
		{ kind: 'search', icon: '🔍', label: 'ตรวจสอบ', text: 'สำรวจรอบตัวหาสิ่งผิดปกติ' },
		{ kind: 'talk', icon: '💬', label: 'พูดคุย', text: 'เข้าไปคุยกับตัวละครที่อยู่ตรงนั้น' },
		{ kind: 'flee', icon: '🏃', label: 'หนี', text: 'หนีออกจากจุดนี้ให้ไวที่สุด!' }
	];

	function submitFree() {
		const value = text.trim();
		if (!value || busy) return;
		onsend('free', value);
		text = '';
	}

	function submitQuick(kind: SendKind, quickText: string) {
		if (busy) return;
		onsend(kind, quickText);
	}

	function submitDice() {
		if (busy) return;
		diceRolling = true;
		onsend('roll', `ทอยเช็ค ${STAT_LABELS_TH[diceStat]} (DC ${diceDc})`, diceStat, diceDc);
		setTimeout(() => {
			diceRolling = false;
			diceOpen = false;
		}, 550);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submitFree();
		}
	}
</script>

<div
	class="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6"
	use:clickOutside={() => (diceOpen = false)}
>
	<div class="mx-auto w-full max-w-3xl space-y-2.5">
		<!-- Quick actions + dice tray -->
		<div class="flex flex-wrap items-center gap-2">
			{#each quickActions as action (action.kind)}
				<button
					type="button"
					disabled={busy}
					onclick={() => submitQuick(action.kind, action.text)}
					title={action.label}
					class="quick-chip"
				>
					<span aria-hidden="true">{action.icon}</span>
					<span>{action.label}</span>
				</button>
			{/each}
			<button
				type="button"
				disabled={busy}
				onclick={() => (diceOpen = !diceOpen)}
				class="quick-chip"
				aria-expanded={diceOpen}
			>
				<Dices class="size-3.5" aria-hidden="true" />
				<span>ทอยเต๋า</span>
			</button>
		</div>

		{#if diceOpen}
			<div class="dice-panel msg-enter">
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs text-muted-foreground">ค่าสถานะ:</span>
					{#each STAT_KEYS as key (key)}
						<button
							type="button"
							onclick={() => (diceStat = key)}
							class="pick-chip {diceStat === key ? 'pick-active' : ''}"
						>
							{key.toUpperCase()}
						</button>
					{/each}
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs text-muted-foreground">ระดับความยาก:</span>
					{#each DC_OPTIONS as option (option.value)}
						<button
							type="button"
							onclick={() => (diceDc = option.value)}
							class="pick-chip {diceDc === option.value ? 'pick-active' : ''}"
						>
							{option.label}
							{option.value}
						</button>
					{/each}
				</div>
				<Button size="sm" class="self-start" onclick={submitDice}>
					<span class="dice-face {diceRolling ? 'dice-rolling' : ''}" aria-hidden="true">🎲</span>
					{diceRolling ? 'กำลังทอย...' : 'ทอยเลย'}
				</Button>
			</div>
		{/if}

		<!-- Free text — always available: unlimited direction is the product -->
		<div class="flex items-center gap-2">
			<Input
				bind:value={text}
				onkeydown={onKeydown}
				disabled={busy}
				placeholder={busy ? 'ผู้เล่าเรื่องกำลังเล่า...' : 'พิมพ์อะไรก็ได้ที่ฮีโร่จะทำ...'}
				aria-label="คำสั่งของผู้เล่น"
				class="h-11 flex-1 text-[15px]"
			/>
			{#if busy}
				<Button variant="destructive" size="lg" class="h-11" onclick={onstop}>
					<Square class="size-4" aria-hidden="true" />
					หยุด
				</Button>
			{:else}
				<Button size="lg" class="h-11" onclick={submitFree} disabled={!text.trim()}>
					<Send class="size-4" aria-hidden="true" />
					ส่ง
				</Button>
			{/if}
		</div>
	</div>
</div>

<style>
	.quick-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		background: color-mix(in oklch, var(--color-card) 55%, transparent);
		padding: 0.3rem 0.8rem;
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out),
			transform 0.12s var(--ease-out);
	}
	.quick-chip:active {
		transform: scale(0.96);
	}
	.quick-chip:disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	.dice-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		background: color-mix(in oklch, var(--color-card) 70%, transparent);
		padding: 0.75rem 0.9rem;
	}

	.pick-chip {
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.12rem 0.6rem;
		font-size: 0.72rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
	}
	.pick-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
		font-weight: 600;
	}

	@media (hover: hover) and (pointer: fine) {
		.quick-chip:hover:not(:disabled) {
			color: var(--color-foreground);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}

	@keyframes dice-tumble {
		0% {
			transform: rotate(0deg) scale(1);
		}
		45% {
			transform: rotate(300deg) scale(1.25);
		}
		100% {
			transform: rotate(720deg) scale(1);
		}
	}
	.dice-rolling {
		display: inline-block;
		animation: dice-tumble 0.55s var(--ease-in-out);
	}

	@media (prefers-reduced-motion: reduce) {
		.quick-chip,
		.pick-chip {
			transition: none;
		}
		.quick-chip:active {
			transform: none;
		}
		.dice-rolling {
			animation: none;
		}
	}
</style>
