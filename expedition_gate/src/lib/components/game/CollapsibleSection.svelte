<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		title,
		open = true,
		children
	}: {
		title: string;
		open?: boolean;
		children: import('svelte').Snippet;
	} = $props();

	// Deliberately uncontrolled after mount: `open` is only the initial state.
	// svelte-ignore state_referenced_locally
	let expanded = $state(open);
</script>

<div class="collapsible">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-2 py-0.5 text-left"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		<h3 class="text-[11px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
			{title}
		</h3>
		<ChevronDown
			class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 {expanded
				? 'rotate-180'
				: ''}"
			aria-hidden="true"
		/>
	</button>
	{#if expanded}
		<div class="mt-1.5">
			{@render children()}
		</div>
	{/if}
</div>
