<script lang="ts">
	import type { WorldState } from '$lib/game/worldstate';
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { world }: { world: WorldState } = $props();

	const DISPOSITION_TH: Record<number, string> = {
		[-3]: 'เกลียดชัง',
		[-2]: 'ไม่พอใจ',
		[-1]: 'ระแวง',
		0: 'เป็นกลาง',
		1: 'เป็นมิตร',
		2: 'ไว้ใจ',
		3: 'ภักดี'
	};

	const alive = $derived(world.npcs.filter((npc) => npc.status === 'มีชีวิต'));
</script>

{#if alive.length}
	<CollapsibleSection title="ตัวละครที่พบ ({alive.length})" open={false}>
		<ul class="space-y-1.5">
			{#each alive.slice(0, 12) as npc (npc.id)}
				<li class="rounded-lg border border-border/60 bg-card/50 px-2.5 py-1.5">
					<div class="flex items-baseline justify-between gap-2">
						<p class="truncate text-[13px] font-medium">{npc.name}</p>
						<span class="shrink-0 text-[10px] text-muted-foreground">
							{DISPOSITION_TH[npc.disposition] ?? 'เป็นกลาง'}
						</span>
					</div>
					{#if npc.role}
						<p class="truncate text-[11px] text-muted-foreground">{npc.role}</p>
					{/if}
				</li>
			{/each}
		</ul>
	</CollapsibleSection>
{/if}
