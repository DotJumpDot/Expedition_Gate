<script lang="ts">
	import { History } from '@lucide/svelte';

	let { text }: { text: string } = $props();

	let open = $state(false);
</script>

{#if text}
	<div class="recap-card">
		<button type="button" class="recap-header" onclick={() => (open = !open)} aria-expanded={open}>
			<History class="size-3.5 shrink-0" aria-hidden="true" />
			<span class="font-semibold">ก่อนหน้านี้…</span>
			<span class="ml-auto text-xs text-muted-foreground">{open ? 'ซ่อน' : 'อ่านสรุป'}</span>
		</button>
		{#if open}
			<p class="recap-body">{text}</p>
		{/if}
	</div>
{/if}

<style>
	.recap-card {
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		background: color-mix(in oklch, var(--color-muted) 45%, transparent);
		padding: 0.6rem 0.9rem;
	}

	.recap-header {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--color-foreground);
	}

	.recap-body {
		margin-top: 0.5rem;
		border-top: 1px solid color-mix(in oklch, var(--color-border) 70%, transparent);
		padding-top: 0.5rem;
		font-size: 0.85rem;
		line-height: 1.75;
		color: var(--color-muted-foreground);
		white-space: pre-wrap;
	}
</style>
