<script lang="ts">
	import type { WorldState } from '$lib/game/worldstate';

	let { world }: { world: WorldState } = $props();

	const scene = $derived(world.world);
	const TIME_ICON: Record<string, string> = {
		เช้า: '🌅',
		สาย: '☀️',
		บ่าย: '🌤️',
		เย็น: '🌇',
		กลางคืน: '🌙'
	};
</script>

<div class="scene-card">
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
		<span class="scene-tag">🗺️ {scene.sceneTag}</span>
		<h2 class="text-sm font-bold">{scene.location}</h2>
		<span class="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
			วันที่ {scene.day} · {TIME_ICON[scene.timeOfDay] ?? ''}
			{scene.timeOfDay}
			{#if scene.weather}
				· {scene.weather}
			{/if}
		</span>
	</div>
</div>

<style>
	.scene-card {
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		background:
			radial-gradient(ellipse 90% 120% at 12% -30%, oklch(0.7 0.16 55 / 8%), transparent 60%),
			color-mix(in oklch, var(--color-card) 75%, transparent);
		padding: 0.7rem 1rem;
	}

	.scene-tag {
		display: inline-block;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-gold) 30%, transparent);
		background: color-mix(in oklch, var(--color-gold) 8%, transparent);
		padding: 0.15rem 0.65rem;
		font-size: 0.75rem;
		color: var(--color-gold);
		text-transform: lowercase;
	}
</style>
