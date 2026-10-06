<script lang="ts">
	import { friendlyResolution } from '$lib/narration';

	let {
		resolution,
		dice = undefined,
		live = false
	}: {
		resolution: string;
		dice?: unknown[];
		live?: boolean;
	} = $props();

	const view = $derived(friendlyResolution(resolution, dice));
</script>

<div class="res-chip res-{view.tone}" role="status" data-live={live}>
	<span class="res-dice" aria-hidden="true">🎲</span>
	<span class="text-center whitespace-pre-line">{view.text}</span>
</div>

<style>
	.res-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-inline: auto;
		max-width: 90%;
		border-radius: var(--radius-lg);
		border: 1px solid;
		padding: 0.4rem 0.9rem;
		font-size: 0.82rem;
		font-weight: 600;
	}

	.res-good {
		border-color: color-mix(in oklch, var(--color-xp) 40%, transparent);
		background: color-mix(in oklch, var(--color-xp) 10%, transparent);
		color: var(--color-xp);
	}
	.res-bad {
		border-color: color-mix(in oklch, var(--color-destructive) 40%, transparent);
		background: color-mix(in oklch, var(--color-destructive) 10%, transparent);
		color: var(--color-destructive);
	}
	.res-neutral {
		border-color: color-mix(in oklch, var(--color-gold) 30%, transparent);
		background: color-mix(in oklch, var(--color-gold) 8%, transparent);
		color: var(--color-gold);
	}

	/* The die tumbles in exactly once. */
	@keyframes res-dice-in {
		from {
			transform: rotate(-180deg) scale(0.6);
		}
	}
	.res-dice {
		display: inline-block;
		animation: res-dice-in 0.45s var(--ease-out) backwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.res-dice {
			animation: none;
		}
	}
</style>
