<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { WorldState } from '$lib/game/worldstate';
	import { pickNpcPortrait, type PortraitEntry } from '$lib/game/portraits';
	import CollapsibleSection from './CollapsibleSection.svelte';

	let { world }: { world: WorldState } = $props();

	let library = $state<PortraitEntry[]>([]);

	onMount(async () => {
		try {
			const res = await fetch('/api/portraits', { cache: 'no-store' });
			const data = (await res.json()) as { portraits: PortraitEntry[] };
			library = data.portraits.filter((entry) => entry.available);
		} catch {
			library = [];
		}
	});

	function faceFor(npc: { id: string; name: string; role: string }): PortraitEntry | null {
		return pickNpcPortrait(library, npc.name, npc.role);
	}

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
				{@const face = library.length > 0 ? faceFor(npc) : null}
				<li class="rounded-lg border border-border/60 bg-card/50 px-2.5 py-1.5">
					<div class="flex items-center gap-2.5">
						{#if face}
							{#key face.url}
								<img
									src={face.url}
									alt=""
									in:fade={{ duration: 200 }}
									class="npc-face"
									loading="lazy"
								/>
							{/key}
						{:else}
							<div class="npc-face npc-face-fallback" aria-hidden="true">
								{npc.name.slice(0, 1)}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline justify-between gap-2">
								<p class="truncate text-[13px] font-medium">{npc.name}</p>
								<span class="shrink-0 text-[10px] text-muted-foreground">
									{DISPOSITION_TH[npc.disposition] ?? 'เป็นกลาง'}
								</span>
							</div>
							{#if npc.role}
								<p class="truncate text-[11px] text-muted-foreground">{npc.role}</p>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</CollapsibleSection>
{/if}

<style>
	.npc-face {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		object-fit: cover;
		object-position: top;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 70%, transparent);
	}

	.npc-face-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-muted-foreground);
		background: color-mix(in oklch, var(--color-muted) 55%, transparent);
	}
</style>
