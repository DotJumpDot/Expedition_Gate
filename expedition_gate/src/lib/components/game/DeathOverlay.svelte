<script lang="ts">
	import { goto } from '$app/navigation';
	import { DoorOpen, Minus, Plus, ScrollText, Skull, Sparkles } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { STAT_KEYS, STAT_LABELS_TH, type Stats } from '$lib/server/engine/rules';
	import type { HeroProposal } from '$lib/server/engine/gm';
	import type { WorldBrief, WorldState } from '$lib/server/engine/worldstate';

	let {
		campaignId,
		world,
		ended,
		onEpilogue
	}: {
		campaignId: string;
		world: WorldState;
		ended: string | null;
		onEpilogue: () => Promise<boolean>;
	} = $props();

	let phase = $state<'dead' | 'epilogue'>('dead');
	let epilogueBusy = $state(false);

	onMount(() => {
		if (ended === 'epilogue') phase = 'epilogue';
	});

	// Rebirth (ประตูบานใหม่) mini-wizard state
	let rebirthOpen = $state(false);
	let heroName = $state('');
	let heroConcept = $state('');
	let heroClass = $state('นักดาบ');
	let proposal = $state<HeroProposal | null>(null);
	let stats = $state<Stats | null>(null);
	let rebirthBusy = $state(false);
	let rebirthError = $state('');

	const CLASS_OPTIONS = ['นักดาบ', 'นักเวท', 'โจร', 'นักบวช', 'หมอผี', 'นักล่า'];
	const statTotal = $derived(stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0);
	const pointsLeft = $derived(52 - statTotal);

	async function requestEpilogue() {
		epilogueBusy = true;
		const ok = await onEpilogue();
		epilogueBusy = false;
		if (ok) phase = 'epilogue';
	}

	async function generateProposal() {
		rebirthBusy = true;
		rebirthError = '';
		try {
			const campaignRes = await fetch(`/api/campaigns/${campaignId}`, { cache: 'no-store' });
			const campaignData = (await campaignRes.json()) as { campaign: { brief: WorldBrief } };
			const res = await fetch('/api/campaigns/hero-proposal', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					brief: campaignData.campaign.brief,
					name: heroName,
					concept: heroConcept,
					klass: heroClass
				})
			});
			const data = (await res.json()) as { proposal?: HeroProposal; error?: string };
			if (!res.ok || !data.proposal) throw new Error(data.error ?? 'สร้างฮีโร่ไม่สำเร็จ');
			proposal = data.proposal;
			stats = { ...data.proposal.stats };
		} catch (err) {
			rebirthError = err instanceof Error ? err.message : 'สร้างฮีโร่ไม่สำเร็จ';
		} finally {
			rebirthBusy = false;
		}
	}

	function bumpStat(key: keyof Stats, delta: number) {
		if (!stats) return;
		if (delta > 0 && (pointsLeft <= 0 || stats[key] >= 10)) return;
		if (delta < 0 && stats[key] <= 1) return;
		stats = { ...stats, [key]: stats[key] + delta };
	}

	async function startRebirth() {
		if (!stats || !proposal || pointsLeft !== 0) return;
		rebirthBusy = true;
		rebirthError = '';
		try {
			const res = await fetch('/api/campaigns/rebirth', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					campaignId,
					heroName,
					heroConcept,
					heroClass,
					proposal: { ...proposal, stats }
				})
			});
			const data = (await res.json()) as { id?: string; error?: string };
			if (!res.ok || !data.id) throw new Error(data.error ?? 'สร้างการผจญภัยไม่สำเร็จ');
			await goto(`/campaign/${data.id}`);
		} catch (err) {
			rebirthError = err instanceof Error ? err.message : 'สร้างการผจญภัยไม่สำเร็จ';
			rebirthBusy = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-8">
	<div class="death-scrim" aria-hidden="true"></div>

	<div class="death-card msg-enter" role="dialog" aria-modal="true" aria-label="การผจญภัยจบลง">
		{#if phase === 'dead'}
			<div class="flex flex-col items-center gap-4 px-6 py-10 text-center">
				<Skull class="size-9 text-destructive" aria-hidden="true" />
				<div>
					<h2 class="text-2xl font-bold">การผจญภัยจบลง</h2>
					<p class="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
						{world.hero.name} ({world.hero.klass}) จบชีวิตที่{world.world.location}
						ในวันที่ {world.world.day} ของการผจญภัย — เรื่องราวของเขาจะถูกจารไว้ในพงศาวดารของโลกนี้
					</p>
				</div>
				<div class="flex flex-wrap justify-center gap-2">
					<Button size="lg" onclick={requestEpilogue} disabled={epilogueBusy}>
						<ScrollText data-icon="inline-start" aria-hidden="true" />
						{epilogueBusy ? 'ผู้เล่าเรื่องกำลังเขียนบทส่งท้าย...' : 'ขอบทส่งท้าย'}
					</Button>
					<Button variant="ghost" size="lg" href="/">กลับสู่ประตู</Button>
				</div>
			</div>
		{:else if !rebirthOpen}
			<div class="flex flex-col items-center gap-4 px-6 py-10 text-center">
				<DoorOpen class="size-9 text-gold" aria-hidden="true" />
				<div>
					<h2 class="text-2xl font-bold">ประตูบานใหม่</h2>
					<p class="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
						โลกนี้ยังอยู่ — ความตายของฮีโร่คนก่อนเป็นเพียงหนึ่งบทในพงศาวดาร
						ประตูบานใหม่เปิดรอผู้กล้าคนถัดไป พร้อมโลก ตัวละคร และเควสเดิมที่ยังไม่จบ
					</p>
				</div>
				<div class="flex flex-wrap justify-center gap-2">
					<Button size="lg" onclick={() => (rebirthOpen = true)}>
						<Sparkles data-icon="inline-start" aria-hidden="true" />
						สร้างฮีโร่ใหม่ในโลกเดิม
					</Button>
					<Button variant="ghost" size="lg" href="/">กลับสู่ประตู</Button>
				</div>
			</div>
		{:else if !proposal}
			<div class="space-y-4 px-6 py-8">
				<h2 class="text-lg font-bold">ผู้กล้าคนใหม่ของ{world.world.location}</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					<div>
						<label
							class="mb-1 block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
							for="rb-name">ชื่อ</label
						>
						<Input
							id="rb-name"
							bind:value={heroName}
							placeholder="เช่น ค่ำ วิญญาณดำ"
							class="h-10"
						/>
					</div>
					<div>
						<p class="mb-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
							สายอาชีพ
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each CLASS_OPTIONS as option (option)}
								<button
									type="button"
									class="tone-chip {heroClass === option ? 'tone-active' : ''}"
									onclick={() => (heroClass = option)}
								>
									{option}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<div>
					<label
						class="mb-1 block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
						for="rb-concept">คอนเซปต์</label
					>
					<Input
						id="rb-concept"
						bind:value={heroConcept}
						placeholder="เช่น นักล่าที่ตามรอยเลือดมาถึงประตูนี้"
						class="h-10"
					/>
				</div>
				{#if rebirthError}
					<p class="text-sm text-destructive" role="alert">{rebirthError}</p>
				{/if}
				<Button size="lg" class="w-full" onclick={generateProposal} disabled={rebirthBusy}>
					<Sparkles data-icon="inline-start" aria-hidden="true" />
					{rebirthBusy ? 'AI กำลังจัดค่าให้...' : 'ให้ AI จัดค่าให้'}
				</Button>
			</div>
		{:else}
			<div class="space-y-4 px-6 py-8">
				<div class="rounded-lg border border-border/60 bg-card/50 p-3.5">
					<p class="mb-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
						ปูมหลัง
					</p>
					<p class="text-sm leading-relaxed text-pretty">{proposal.background}</p>
				</div>
				{#if stats}
					<div>
						<div class="mb-2 flex items-baseline justify-between">
							<p class="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
								ค่าสถานะ
							</p>
							<p class="text-xs {pointsLeft === 0 ? 'text-xp' : 'text-gold'}">
								แต้มเหลือ {pointsLeft}
							</p>
						</div>
						<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
							{#each STAT_KEYS as key (key)}
								<div class="stat-box">
									<span class="text-[11px] text-muted-foreground">{STAT_LABELS_TH[key]}</span>
									<span class="text-sm font-bold tabular-nums"
										>{key.toUpperCase()} {stats[key]}</span
									>
									<span class="flex gap-1">
										<button
											type="button"
											class="step-btn"
											onclick={() => bumpStat(key, -1)}
											aria-label="ลด {STAT_LABELS_TH[key]}"
										>
											<Minus class="size-3" aria-hidden="true" />
										</button>
										<button
											type="button"
											class="step-btn"
											onclick={() => bumpStat(key, 1)}
											aria-label="เพิ่ม {STAT_LABELS_TH[key]}"
										>
											<Plus class="size-3" aria-hidden="true" />
										</button>
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
				{#if rebirthError}
					<p class="text-sm text-destructive" role="alert">{rebirthError}</p>
				{/if}
				<div class="flex gap-2">
					<Button variant="outline" onclick={generateProposal} disabled={rebirthBusy}
						>🎲 จัดใหม่</Button
					>
					<Button class="flex-1" onclick={startRebirth} disabled={rebirthBusy || pointsLeft !== 0}>
						{rebirthBusy
							? 'กำลังเปิดประตู...'
							: pointsLeft === 0
								? 'ก้าวผ่านประตูบานใหม่'
								: 'แจกแต้มให้ครบ 52'}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.death-scrim {
		position: absolute;
		inset: 0;
		background: oklch(0.08 0.01 27 / 85%);
		backdrop-filter: blur(7px);
	}

	.death-card {
		position: relative;
		margin: 6vh auto;
		width: 100%;
		max-width: 600px;
		border-radius: calc(var(--radius-lg) + 4px);
		border: 1px solid color-mix(in oklch, var(--color-destructive) 25%, transparent);
		background:
			radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.577 0.2 27 / 12%), transparent 65%),
			var(--color-popover);
		box-shadow: 0 24px 64px oklch(0 0 0 / 60%);
	}

	.tone-chip {
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.32rem 0.85rem;
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out);
	}
	.tone-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
		font-weight: 600;
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
	}
	.step-btn:active {
		transform: scale(0.9);
	}

	.msg-enter {
		animation: card-rise 0.3s var(--ease-out) backwards;
	}

	@keyframes card-rise {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.97);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.msg-enter {
			animation: none;
		}
	}
</style>
