<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import X from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import type { WorldState } from '$lib/game/worldstate';

	let { world, onclose }: { world: WorldState; onclose: () => void } = $props();

	const aliveNpcs = $derived(world.npcs.filter((npc) => npc.status === 'มีชีวิต'));
	const goneNpcs = $derived(world.npcs.filter((npc) => npc.status !== 'มีชีวิต'));
	const flagsOn = $derived(
		Object.entries(world.world.flags)
			.filter(([, on]) => on)
			.map(([key]) => key)
	);
</script>

<div class="codex-panel panel-enter" role="dialog" aria-label="บันทึกแห่งโลก">
	<header class="flex items-center justify-between border-b border-border/60 px-4 py-3">
		<h2 class="flex items-center gap-2 text-sm font-bold">
			<BookOpen class="size-4 text-gold" aria-hidden="true" />
			บันทึกแห่งโลก
		</h2>
		<Button variant="ghost" size="icon-sm" onclick={onclose}>
			<X class="size-4" aria-hidden="true" />
		</Button>
	</header>

	<div class="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3">
		<section>
			<h3 class="codex-heading">ความรู้ที่ค้นพบ</h3>
			{#if world.world.lore.length}
				<ul class="space-y-1 text-[13px] leading-relaxed">
					{#each world.world.lore as entry (entry)}
						<li>· {entry}</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-muted-foreground">ยังไม่มีบันทึก</p>
			{/if}
		</section>

		<section>
			<h3 class="codex-heading">ตัวละครที่รู้จัก</h3>
			{#if world.npcs.length}
				<ul class="space-y-1 text-[13px]">
					{#each aliveNpcs as npc (npc.id)}
						<li class="flex items-baseline justify-between gap-2">
							<span>· {npc.name}{npc.role ? ` — ${npc.role}` : ''}</span>
							<span class="text-[11px] text-muted-foreground">{npc.status}</span>
						</li>
					{/each}
					{#each goneNpcs as npc (npc.id)}
						<li class="flex items-baseline justify-between gap-2 opacity-60">
							<span>· {npc.name}</span>
							<span class="text-[11px] text-muted-foreground">{npc.status}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-muted-foreground">ยังไม่พบใคร</p>
			{/if}
		</section>

		<section>
			<h3 class="codex-heading">เควส</h3>
			{#if world.quests.length}
				<ul class="space-y-1 text-[13px]">
					{#each world.quests as quest (quest.id)}
						<li>
							· [{quest.status === 'active'
								? 'กำลังทำ'
								: quest.status === 'done'
									? 'สำเร็จ'
									: 'ล้มเหลว'}] {quest.title}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-muted-foreground">ยังไม่มีเควส</p>
			{/if}
		</section>

		{#if flagsOn.length}
			<section>
				<h3 class="codex-heading">ธงเหตุการณ์</h3>
				<p class="text-[13px]">· {flagsOn.join(' · ')}</p>
			</section>
		{/if}

		<section>
			<h3 class="codex-heading">เหตุการณ์ล่าสุด</h3>
			{#if world.recentEvents.length}
				<ul class="space-y-1 text-[12px] text-muted-foreground">
					{#each world.recentEvents as event (event)}
						<li>· {event}</li>
					{/each}
				</ul>
			{:else}
				<p class="text-xs text-muted-foreground">ยังไม่มีบันทึก</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.codex-panel {
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

	.codex-heading {
		margin-bottom: 0.4rem;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--color-muted-foreground);
	}
</style>
