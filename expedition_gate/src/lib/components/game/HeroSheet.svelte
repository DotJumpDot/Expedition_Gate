<script lang="ts">
	import type { WorldState } from '$lib/game/worldstate';
	import { STAT_LABELS_TH, isUsableItem } from '$lib/game/rules';
	import CollapsibleSection from './CollapsibleSection.svelte';
	import HeroPortrait from './HeroPortrait.svelte';

	let {
		world,
		campaignId,
		disabled = false,
		onuseitem
	}: {
		world: WorldState;
		campaignId: string;
		disabled?: boolean;
		onuseitem?: (name: string) => void;
	} = $props();

	const hero = $derived(world.hero);
	const statGroups = $derived([
		{ label: 'กาย', keys: ['str', 'agi', 'dex', 'vit'] as const },
		{ label: 'จิต', keys: ['int', 'spi', 'cha'] as const },
		{ label: 'ชะตา', keys: ['luk'] as const }
	]);

	const hpPct = $derived(hero.maxHp > 0 ? hero.hp / hero.maxHp : 0);
	const mpPct = $derived(hero.maxMp > 0 ? hero.mp / hero.maxMp : 0);

	// Damage shake / heal pulse — react to HP deltas, never on first render.
	let hpFx = $state<'hit' | 'heal' | null>(null);
	let prevHp: number | null = null;
	$effect(() => {
		const hp = hero.hp;
		if (prevHp === null) {
			prevHp = hp;
			return;
		}
		if (hp !== prevHp) {
			hpFx = hp < prevHp ? 'hit' : 'heal';
			prevHp = hp;
			const timer = setTimeout(() => (hpFx = null), 700);
			return () => clearTimeout(timer);
		}
	});
</script>

<div class="space-y-4">
	<header class="flex items-center gap-3">
		<HeroPortrait heroName={hero.name} klass={hero.klass} {campaignId} />
		<div>
			<h2 class="text-base font-bold">{hero.name}</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">{hero.klass} · LV {hero.level}</p>
		</div>
	</header>

	<div class="space-y-2.5">
		<div class="hp-block {hpFx === 'hit' ? 'hp-hit' : hpFx === 'heal' ? 'hp-heal' : ''}">
			<div class="mb-1 flex items-baseline justify-between text-xs">
				<span class="font-semibold text-hp">พลังชีวิต</span>
				<span class="tabular-nums">{hero.hp}/{hero.maxHp}</span>
			</div>
			<div class="bar-track">
				<div class="bar-fill bg-hp" style="transform: scaleX({hpPct})"></div>
			</div>
		</div>
		<div>
			<div class="mb-1 flex items-baseline justify-between text-xs">
				<span class="font-semibold text-mana">มานา</span>
				<span class="tabular-nums">{hero.mp}/{hero.maxMp}</span>
			</div>
			<div class="bar-track">
				<div class="bar-fill bg-mana" style="transform: scaleX({mpPct})"></div>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-card/50 p-3">
		{#each statGroups as group (group.label)}
			{#if group.label !== 'ชะตา'}
				<div class="contents">
					{#each group.keys as key (key)}
						<div class="flex items-baseline justify-between text-[13px]">
							<span class="text-muted-foreground">{STAT_LABELS_TH[key]}</span>
							<span class="font-bold tabular-nums">{hero.stats[key]}</span>
						</div>
					{/each}
				</div>
			{/if}
		{/each}
		<div class="flex items-baseline justify-between text-[13px]">
			<span class="text-muted-foreground">{STAT_LABELS_TH.luk}</span>
			<span class="flex items-center gap-1.5 font-bold tabular-nums">
				{hero.stats.luk}
				{#if hero.luckPoints > 0}
					<span class="text-gold" title="แต้มดวงคงเหลือ">🎲{hero.luckPoints}</span>
				{/if}
			</span>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 text-xs">
		<span class="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-gold"
			>💰 {hero.gold} ทอง</span
		>
		{#each hero.conditions as condition (condition)}
			<span
				class="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-destructive"
				>{condition}</span
			>
		{/each}
	</div>

	{#if hero.equipment.weapon || hero.equipment.armor}
		<CollapsibleSection title="อาวุธ · เกราะ">
			<div class="flex flex-wrap items-center gap-2 text-xs">
				{#if hero.equipment.weapon}
					<span class="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5"
						>⚔️ {hero.equipment.weapon.label}</span
					>
				{/if}
				{#if hero.equipment.armor}
					<span class="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5"
						>🛡️ {hero.equipment.armor.label}</span
					>
				{/if}
			</div>
		</CollapsibleSection>
	{/if}

	{#if hero.inventory.length}
		<CollapsibleSection title="ของติดตัว">
			<ul class="space-y-1 text-[13px]">
				{#each hero.inventory as item (item.name)}
					<li class="flex items-baseline justify-between gap-2">
						<span>· {item.name}{item.note ? ` (${item.note})` : ''}</span>
						<span class="flex items-center gap-1.5">
							{#if item.qty > 1}
								<span class="text-muted-foreground tabular-nums">×{item.qty}</span>
							{/if}
							{#if onuseitem && isUsableItem(item.name)}
								<button
									type="button"
									class="use-btn"
									{disabled}
									onclick={() => onuseitem(item.name)}
									aria-label="ใช้ {item.name}"
								>
									ใช้
								</button>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		</CollapsibleSection>
	{/if}
</div>

<style>
	.bar-track {
		height: 8px;
		overflow: hidden;
		border-radius: 9999px;
		background: color-mix(in oklch, var(--color-muted) 70%, transparent);
	}

	.bar-fill {
		height: 100%;
		width: 100%;
		transform-origin: left center;
		border-radius: 9999px;
		transition: transform 0.5s var(--ease-out);
	}

	/* Damage shake / heal pulse — short, causal, once per change. */
	@keyframes hp-shake {
		20% {
			transform: translateX(-4px);
		}
		45% {
			transform: translateX(3px);
		}
		70% {
			transform: translateX(-2px);
		}
	}
	@keyframes hp-glow {
		30% {
			filter: brightness(1.35);
		}
	}
	.hp-hit {
		animation: hp-shake 0.45s var(--ease-out);
	}
	.hp-heal {
		animation: hp-glow 0.6s var(--ease-out);
	}

	/* Potion "ใช้" — press feedback only; it's data-adjacent, not decoration. */
	.use-btn {
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.05rem 0.55rem;
		font-size: 0.68rem;
		color: var(--color-muted-foreground);
		transition:
			transform 0.12s var(--ease-out),
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out);
	}
	.use-btn:active {
		transform: scale(0.94);
	}
	.use-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.hp-hit,
		.hp-heal {
			animation: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar-fill {
			transition: none;
		}
		.use-btn {
			transition: none;
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.use-btn:not(:disabled):hover {
			color: var(--color-gold);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}
</style>
