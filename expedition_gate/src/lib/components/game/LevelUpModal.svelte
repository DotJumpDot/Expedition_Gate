<script lang="ts">
	import { Minus, Plus, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { STAT_KEYS, STAT_LABELS_TH, xpToNext, type Stats } from '$lib/game/rules';
	import type { WorldState } from '$lib/game/worldstate';

	let {
		world,
		onapply,
		ondismiss
	}: {
		world: WorldState;
		onapply: (
			allocations: Partial<Record<keyof Stats, number>>
		) => Promise<{ ok: boolean; error?: string }>;
		ondismiss: () => void;
	} = $props();

	const LEVEL_POINTS = 2;
	let allocations = $state<Partial<Record<keyof Stats, number>>>({});
	let error = $state('');
	let busy = $state(false);

	const spent = $derived(Object.values(allocations).reduce((sum, value) => sum + (value ?? 0), 0));
	const left = $derived(LEVEL_POINTS - spent);
	const projected = $derived(
		Object.fromEntries(
			STAT_KEYS.map((key) => [key, world.hero.stats[key] + (allocations[key] ?? 0)])
		) as Record<keyof Stats, number>
	);

	function bump(key: keyof Stats, delta: number) {
		const current = allocations[key] ?? 0;
		if (delta > 0 && (left <= 0 || world.hero.stats[key] + current >= 10)) return;
		if (delta < 0 && current <= 0) return;
		allocations = { ...allocations, [key]: current + delta };
	}

	async function apply() {
		if (left !== 0) return;
		busy = true;
		error = '';
		const result = await onapply(allocations);
		busy = false;
		if (!result.ok) error = result.error ?? 'เก็บระดับไม่สำเร็จ';
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<button class="modal-scrim" aria-label="ปิด" onclick={ondismiss}></button>
	<div class="levelup-card msg-enter" role="dialog" aria-modal="true" aria-label="เก็บระดับ">
		<header class="border-b border-border/60 px-5 py-3.5">
			<h2 class="flex items-center gap-2 text-base font-bold">
				<Sparkles class="size-4 text-gold" aria-hidden="true" />
				เก็บระดับ! LV {world.hero.level} → {world.hero.level + 1}
			</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">
				จัดแต้มสถานะ {LEVEL_POINTS} แต้ม — HP +VIT×2 · มานา +INT×2 อัตโนมัติ
			</p>
		</header>

		<div class="space-y-3 px-5 py-4">
			<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
				{#each STAT_KEYS as key (key)}
					<div class="stat-box">
						<span class="text-[11px] text-muted-foreground">
							{STAT_LABELS_TH[key]}
							{#if (allocations[key] ?? 0) > 0}
								<span class="text-xp">+{allocations[key]}</span>
							{/if}
						</span>
						<span class="text-sm font-bold tabular-nums">
							{world.hero.stats[key]}→{projected[key]}
						</span>
						<span class="flex gap-1">
							<button
								type="button"
								class="step-btn"
								onclick={() => bump(key, -1)}
								aria-label="ลด {STAT_LABELS_TH[key]}"
							>
								<Minus class="size-3" aria-hidden="true" />
							</button>
							<button
								type="button"
								class="step-btn"
								onclick={() => bump(key, 1)}
								aria-label="เพิ่ม {STAT_LABELS_TH[key]}"
							>
								<Plus class="size-3" aria-hidden="true" />
							</button>
						</span>
					</div>
				{/each}
			</div>

			{#if error}
				<p class="text-sm text-destructive" role="alert">{error}</p>
			{/if}

			<div class="flex gap-2">
				<Button variant="ghost" onclick={ondismiss} disabled={busy}>ภายหลัง</Button>
				<Button class="flex-1" onclick={apply} disabled={busy || left !== 0}>
					{busy ? 'กำลังเก็บระดับ...' : left === 0 ? 'ยืนยัน' : `แจกแต้มให้ครบ (เหลือ ${left})`}
				</Button>
			</div>
			<p class="text-[10px] text-muted-foreground">
				XP คงเหลือหลังเก็บระดับ: {world.hero.xp - xpToNext(world.hero.level)} (เก็บระดับถัดไปที่ {xpToNext(
					world.hero.level + 1
				)})
			</p>
		</div>
	</div>
</div>

<style>
	.modal-scrim {
		position: absolute;
		inset: 0;
		background: oklch(0.1 0.01 75 / 70%);
		backdrop-filter: blur(5px);
	}

	.levelup-card {
		position: relative;
		width: 100%;
		max-width: 560px;
		border-radius: calc(var(--radius-lg) + 4px);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background:
			radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.66 0.1 152 / 8%), transparent 65%),
			var(--color-popover);
		box-shadow: 0 24px 64px oklch(0 0 0 / 55%);
	}

	.stat-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		padding: 0.35rem 0.55rem;
	}

	.step-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out);
	}
	.step-btn:active {
		transform: scale(0.9);
	}

	@media (hover: hover) and (pointer: fine) {
		.step-btn:hover {
			color: var(--color-foreground);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}

	.msg-enter {
		animation: card-rise 0.28s var(--ease-out) backwards;
	}

	@keyframes card-rise {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.msg-enter {
			animation: none;
		}
		.step-btn {
			transition: none;
		}
	}
</style>
