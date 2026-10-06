<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import type { SendKind } from '$lib/stores/campaign.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	let {
		chips,
		busy,
		major = false,
		onsend
	}: {
		chips: string[];
		busy: boolean;
		major?: boolean;
		onsend: (kind: SendKind, text: string) => void;
	} = $props();

	const visible = $derived(chips.slice(0, settings.chipCount));
</script>

{#if visible.length > 0 && !busy}
	<div class="msg-enter flex flex-wrap items-center gap-2" aria-label="ทางเลือกถัดไป">
		{#if major}
			<span class="major-label" title="ผู้เล่าเรื่องเปิดทางเลือกสำคัญ">
				<Sparkles class="size-3" aria-hidden="true" />
				จุดตัดสินใจสำคัญ
			</span>
		{/if}
		{#each visible as chip, i (chip)}
			<button
				type="button"
				class="choice-chip {major ? 'choice-major' : ''}"
				style="animation-delay: {Math.min(i * 40, 160)}ms"
				onclick={() => onsend('free', chip)}
			>
				{chip}
			</button>
		{/each}
	</div>
{/if}

<style>
	.choice-chip {
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-gold) 26%, transparent);
		background: color-mix(in oklch, var(--color-card) 65%, transparent);
		padding: 0.42rem 0.95rem;
		font-size: 0.82rem;
		color: var(--color-foreground);
		text-align: left;
		animation: chip-rise 0.28s var(--ease-out) backwards;
		transition:
			border-color 0.15s var(--ease-out),
			background-color 0.15s var(--ease-out),
			transform 0.12s var(--ease-out);
	}
	.choice-chip:active {
		transform: scale(0.96);
	}

	@keyframes chip-rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	.msg-enter {
		animation: chip-rise 0.25s var(--ease-out) backwards;
	}

	.major-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-xp) 45%, transparent);
		background: color-mix(in oklch, var(--color-xp) 12%, transparent);
		padding: 0.3rem 0.75rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--color-xp);
	}

	.choice-major {
		border-color: color-mix(in oklch, var(--color-xp) 45%, transparent);
		background: color-mix(in oklch, var(--color-xp) 8%, transparent);
	}

	@media (hover: hover) and (pointer: fine) {
		.choice-chip:hover {
			border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
			background: color-mix(in oklch, var(--color-gold) 10%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.choice-chip,
		.msg-enter {
			animation: none;
		}
		.choice-chip {
			transition: none;
		}
	}
</style>
