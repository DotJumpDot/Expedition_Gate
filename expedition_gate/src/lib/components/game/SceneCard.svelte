<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Image from '@lucide/svelte/icons/image';
	import { settingPreset, type WorldState } from '$lib/game/worldstate';

	let {
		world,
		setting,
		campaignId
	}: {
		world: WorldState;
		setting: string;
		campaignId: string;
	} = $props();

	interface SceneEntry {
		file: string;
		tags: string[];
		setting: string[];
		source: string;
		license: string;
		author: string;
		url: string;
		available: boolean;
	}

	let library = $state<SceneEntry[]>([]);
	// Anti-repeat recency is heuristic bookkeeping, not render state — a plain
	// variable avoids mutating $state inside $derived (unsafe in Svelte 5).
	let recent: string[] = [];
	let override = $state<string | null>(null);
	let pickerOpen = $state(false);

	function overrideKey(): string {
		return `gate.sceneOverride.${campaignId}`;
	}

	onMount(async () => {
		override = localStorage.getItem(overrideKey());
		try {
			const res = await fetch('/api/scenes', { cache: 'no-store' });
			const data = (await res.json()) as { scenes: SceneEntry[] };
			library = data.scenes.filter((scene) => scene.available);
		} catch {
			library = [];
		}
	});

	function matches(entry: SceneEntry, tag: string): boolean {
		// Art is grouped by bucket, not raw setting key — new presets reuse the
		// closest existing library group (settingPreset fallback: 'any').
		const bucket = settingPreset(setting).art;
		return (
			entry.tags.includes(tag) && (entry.setting.includes('any') || entry.setting.includes(bucket))
		);
	}

	/** Pick a library file for the tag, avoiding the last few used. No match → null. */
	function pickFor(tag: string): string | null {
		const candidates = library.filter((entry) => matches(entry, tag));
		if (candidates.length === 0) return null;
		const fresh = candidates.filter((entry) => !recent.includes(entry.file));
		const pool = fresh.length > 0 ? fresh : candidates;
		const chosen = pool[Math.floor(Math.random() * pool.length)];
		recent = [chosen.file, ...recent.filter((file) => file !== chosen.file)].slice(0, 3);
		return chosen.url;
	}

	const sceneSrc = $derived.by(() => {
		if (override) return override;
		return pickFor(world.world.sceneTag);
	});

	const current = $derived(library.find((entry) => entry.url === sceneSrc) ?? null);

	function setOverride(url: string | null) {
		override = url;
		if (url) localStorage.setItem(overrideKey(), url);
		else localStorage.removeItem(overrideKey());
		pickerOpen = false;
	}

	const TIME_ICON: Record<string, string> = {
		เช้า: '🌅',
		สาย: '☀️',
		บ่าย: '🌤️',
		เย็น: '🌇',
		กลางคืน: '🌙'
	};
</script>

<div class="scene-card">
	<div class="scene-art" aria-hidden="true">
		{#if sceneSrc}
			{#key sceneSrc}
				<img
					src={sceneSrc}
					alt=""
					in:fade={{ duration: 700 }}
					out:fade={{ duration: 700 }}
					class="absolute inset-0 h-full w-full object-cover"
				/>
			{/key}
		{/if}
		<div class="scene-shade"></div>
	</div>

	<div class="relative flex flex-wrap items-center gap-x-3 gap-y-1.5">
		<span class="scene-tag">🗺️ {world.world.sceneTag}</span>
		<h2 class="text-sm font-bold">{world.world.location}</h2>
		<span class="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
			วันที่ {world.world.day} · {TIME_ICON[world.world.timeOfDay] ?? ''}
			{world.world.timeOfDay}
			{#if world.world.weather}
				· {world.world.weather}
			{/if}
		</span>
		{#if library.length > 0}
			<div class="relative">
				<button
					type="button"
					class="art-btn"
					title="เลือกรูปประกอบฉาก"
					aria-expanded={pickerOpen}
					onclick={() => (pickerOpen = !pickerOpen)}
				>
					<Image class="size-3.5" aria-hidden="true" />
				</button>
				{#if pickerOpen}
					<div class="picker panel-enter">
						<div class="flex items-center justify-between px-2.5 py-1.5">
							<p class="text-[11px] font-bold">เลือกรูปจากคลัง ({library.length})</p>
							<button
								type="button"
								class="text-[11px] text-muted-foreground"
								onclick={() => setOverride(null)}
							>
								ใช้อัตโนมัติ
							</button>
						</div>
						<div class="grid max-h-56 grid-cols-3 gap-1 overflow-y-auto px-2 pb-2">
							{#each library as entry (entry.file)}
								<button
									type="button"
									class="picker-item {sceneSrc === entry.url ? 'picker-active' : ''}"
									title={entry.file}
									onclick={() => setOverride(entry.url)}
								>
									<img src={entry.url} alt={entry.file} class="h-full w-full object-cover" />
								</button>
							{/each}
						</div>
						{#if current}
							<p
								class="border-t border-border/60 px-2.5 py-1.5 text-[9px] leading-snug text-muted-foreground"
							>
								{current.license} · {current.author}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.scene-card {
		position: relative;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		background:
			radial-gradient(ellipse 90% 120% at 12% -30%, oklch(0.7 0.16 55 / 8%), transparent 60%),
			color-mix(in oklch, var(--color-card) 75%, transparent);
		padding: 0.7rem 1rem;
	}

	/* The art layer clips ITSELF (rounded corners) — the card must not clip,
	because the art-picker popover opens outside the card's bounds. */
	.scene-art {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
		opacity: 0.5;
	}
	.scene-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to right,
			oklch(0.155 0.012 75 / 82%) 20%,
			oklch(0.155 0.012 75 / 55%) 100%
		);
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

	.art-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		color: var(--color-muted-foreground);
		transition:
			color 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}

	.picker {
		position: absolute;
		right: 0;
		top: 1.9rem;
		/* Above the narration stream and every panel layer below the header. */
		z-index: 45;
		width: 240px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-popover);
		box-shadow: 0 18px 48px oklch(0 0 0 / 50%);
	}

	.picker-item {
		aspect-ratio: 16/9;
		overflow: hidden;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
	}
	.picker-active {
		border-color: color-mix(in oklch, var(--color-gold) 65%, transparent);
	}

	.panel-enter {
		animation: picker-rise 0.2s var(--ease-out) backwards;
	}
	@keyframes picker-rise {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.art-btn:hover {
			color: var(--color-foreground);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel-enter {
			animation: none;
		}
	}
</style>
