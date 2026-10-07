<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import { pickPortrait, type PortraitEntry } from '$lib/game/portraits';

	let {
		heroName,
		klass,
		concept = '',
		campaignId = '',
		readonly = false
	}: {
		heroName: string;
		klass: string;
		/** Concept line — its temperament words narrow the auto-pick. */
		concept?: string;
		campaignId?: string;
		/** Wizard preview: no override picker (no campaign id exists yet). */
		readonly?: boolean;
	} = $props();

	let library = $state<PortraitEntry[]>([]);
	let pickerOpen = $state(false);

	function overrideKey(): string {
		return `gate.portraitOverride.${campaignId}`;
	}

	function loadOverride(): string | null {
		if (typeof localStorage === 'undefined' || !campaignId) return null;
		return localStorage.getItem(overrideKey());
	}

	let overrideFile = $state<string | null>(null);

	onMount(async () => {
		overrideFile = loadOverride();
		try {
			const res = await fetch('/api/portraits', { cache: 'no-store' });
			const data = (await res.json()) as { portraits: PortraitEntry[] };
			library = data.portraits.filter((entry) => entry.available);
		} catch {
			library = [];
		}
	});

	const chosen = $derived.by(() => {
		// Manual 🖼 override wins — but only while the file still exists in the
		// library; otherwise fall through to the deterministic auto-pick.
		if (overrideFile) {
			const hit = library.find((entry) => entry.file === overrideFile);
			if (hit) return hit;
		}
		return pickPortrait(library, klass, heroName, concept);
	});

	function setOverride(file: string | null) {
		overrideFile = file;
		if (file) localStorage.setItem(overrideKey(), file);
		else localStorage.removeItem(overrideKey());
		pickerOpen = false;
	}
</script>

<div class="portrait-block">
	{#if chosen}
		{#key chosen.url}
			<img
				src={chosen.url}
				alt={`ภาพ ${heroName}`}
				in:fade={{ duration: 250 }}
				class="portrait-img"
			/>
		{/key}
	{:else}
		<!-- Fresh clone before generation — an intentional monogram tile, not a broken image -->
		<div class="portrait-fallback" aria-hidden="true">{heroName.slice(0, 1)}</div>
	{/if}

	{#if !readonly && library.length > 0}
		<button
			type="button"
			class="pic-btn"
			title="เลือกรูปฮีโร่"
			aria-expanded={pickerOpen}
			onclick={() => (pickerOpen = !pickerOpen)}
		>
			<ImagePlus class="size-3" aria-hidden="true" />
		</button>
		{#if pickerOpen}
			<div class="picker panel-enter">
				<div class="flex items-center justify-between px-2.5 py-1.5">
					<p class="text-[11px] font-bold">
						เลือกรูป ({library.length})
					</p>
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
							class="picker-item {chosen?.file === entry.file ? 'picker-active' : ''}"
							title={entry.file}
							onclick={() => setOverride(entry.file)}
						>
							<img src={entry.url} alt={entry.file} class="h-full w-full object-cover" />
						</button>
					{/each}
				</div>
				{#if chosen}
					<p
						class="border-t border-border/60 px-2.5 py-1.5 text-[9px] leading-snug text-muted-foreground"
					>
						{chosen.license} · {chosen.author}
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.portrait-block {
		position: relative;
		flex-shrink: 0;
		width: 64px;
		height: 80px;
	}

	.portrait-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 70%, transparent);
		transition: box-shadow 0.2s var(--ease-out);
	}

	/* Intentional empty-state tile (library absent — fresh clone before generation). */
	.portrait-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: var(--radius-lg);
		border: 1px dashed color-mix(in oklch, var(--color-border) 90%, transparent);
		background: color-mix(in oklch, var(--color-muted) 55%, transparent);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-muted-foreground);
	}

	@media (hover: hover) and (pointer: fine) {
		.portrait-block:hover .portrait-img {
			box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-gold) 45%, transparent);
		}
	}

	.pic-btn {
		position: absolute;
		right: -6px;
		bottom: -6px;
		z-index: 46;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-card);
		color: var(--color-muted-foreground);
		transition:
			color 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}

	.picker {
		position: absolute;
		/* Left-aligned under the portrait — stays INSIDE the overflow-scrolling
		   rail (w-72); right-alignment would clip past the rail's edge. */
		left: 0;
		top: calc(100% + 6px);
		/* Above the narration stream and every panel layer below the header. */
		z-index: 45;
		width: 216px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-popover);
		box-shadow: 0 18px 48px oklch(0 0 0 / 50%);
	}

	.picker-item {
		aspect-ratio: 3 / 4;
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
		.pic-btn:hover {
			color: var(--color-foreground);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel-enter {
			animation: none;
		}
		.portrait-img {
			transition: none;
		}
	}
</style>
