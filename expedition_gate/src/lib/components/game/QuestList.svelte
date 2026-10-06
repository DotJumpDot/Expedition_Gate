<script lang="ts">
	import type { WorldState } from '$lib/game/worldstate';
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { world }: { world: WorldState } = $props();

	const STATUS_TH: Record<string, { label: string; cls: string }> = {
		active: { label: 'กำลังทำ', cls: 'text-gold border-gold/35 bg-gold/10' },
		done: { label: 'สำเร็จ', cls: 'text-xp border-xp/35 bg-xp/10' },
		failed: { label: 'ล้มเหลว', cls: 'text-destructive border-destructive/35 bg-destructive/10' }
	};
</script>

{#if world.quests.length}
	<div class="space-y-2">
		<CollapsibleSection title="เควส ({world.quests.length})">
			<ul class="space-y-2">
				{#each world.quests as quest (quest.id)}
					{@const status = STATUS_TH[quest.status] ?? STATUS_TH.active}
					<li class="rounded-lg border border-border/60 bg-card/50 p-2.5">
						<div class="flex items-start justify-between gap-2">
							<p
								class="text-[13px] leading-snug font-medium {quest.status === 'active'
									? ''
									: 'opacity-70'}"
							>
								{quest.title}
							</p>
							<span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] {status.cls}"
								>{status.label}</span
							>
						</div>
						{#if quest.steps.length}
							<ul class="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
								{#each quest.steps as step, i (i)}
									<li>· {step}</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		</CollapsibleSection>
	</div>
{/if}
