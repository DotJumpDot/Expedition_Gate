<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import History from '@lucide/svelte/icons/history';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import Settings from '@lucide/svelte/icons/settings';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import ChoiceChips from '$lib/components/game/ChoiceChips.svelte';
	import CheckpointManager from '$lib/components/game/CheckpointManager.svelte';
	import CommandBar from '$lib/components/game/CommandBar.svelte';
	import DeathOverlay from '$lib/components/game/DeathOverlay.svelte';
	import HeroSheet from '$lib/components/game/HeroSheet.svelte';
	import LevelUpModal from '$lib/components/game/LevelUpModal.svelte';
	import NarrationCard from '$lib/components/game/NarrationCard.svelte';
	import NpcPanel from '$lib/components/game/NpcPanel.svelte';
	import QuestList from '$lib/components/game/QuestList.svelte';
	import RecapCard from '$lib/components/game/RecapCard.svelte';
	import SceneCard from '$lib/components/game/SceneCard.svelte';
	import { session } from '$lib/stores/campaign.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { StatKey, Stats } from '$lib/server/engine/rules';
	import { xpToNext } from '$lib/server/engine/rules';

	let { data }: { data: { id: string; title: string; ended: string | null } } = $props();

	let railOpen = $state(true);
	let cpOpen = $state(false);
	let settingsOpen = $state(false);
	let levelUpOpen = $state(false);
	let narrationEl: HTMLElement | undefined = $state();

	onMount(async () => {
		const ok = await session.load(data.id);
		if (ok && session.messages.length === 0 && !session.ended) {
			void session.send('opening');
		}
	});

	// Keep the newest beat in view while the GM narrates.
	$effect(() => {
		void session.messages.length;
		void session.streaming;
		if (narrationEl) {
			narrationEl.scrollTo({ top: narrationEl.scrollHeight });
		}
	});

	const levelUpReady = $derived(
		Boolean(session.state) &&
			!session.ended &&
			session.state!.hero.xp >= xpToNext(session.state!.hero.level)
	);

	function handleSend(
		kind: Parameters<typeof session.send>[0],
		text: string,
		stat?: StatKey,
		dc?: number
	) {
		void session.send(kind, text, stat, dc);
	}

	function handleCheckpointRestored() {
		cpOpen = false;
		void session.load(data.id);
	}

	async function handleLevelUp(allocations: Partial<Record<keyof Stats, number>>) {
		const result = await session.levelUp(allocations);
		if (result.ok) levelUpOpen = false;
		return result;
	}
</script>

<svelte:head>
	<title>{data.title} — ประตูนักสำรวจ</title>
</svelte:head>

<div class="relative flex h-[calc(100vh-3.5rem)] flex-col">
	<div class="flex min-h-0 flex-1">
		<!-- Left rail: hero sheet + NPCs + quests (collapsible) -->
		{#if railOpen}
			<aside
				class="rail-enter hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border/60 bg-sidebar/40 px-4 py-5 lg:flex"
			>
				{#if session.state}
					<HeroSheet state={session.state} />
					<NpcPanel state={session.state} />
					<QuestList state={session.state} />
				{/if}
			</aside>
		{/if}

		<!-- Center: scene + narration + command bar -->
		<section class="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<div class="flex items-center gap-2 border-b border-border/60 px-4 py-2 sm:px-6">
				<Button variant="ghost" size="sm" href="/">
					<ChevronLeft class="size-4" aria-hidden="true" />
					ประตู
				</Button>
				<h1 class="truncate text-sm font-bold">{data.title}</h1>
				<div class="ml-auto flex items-center gap-1">
					{#if !session.ended}
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => ((cpOpen = !cpOpen), (settingsOpen = false))}
							title="จุดบันทึก"
						>
							<History class="size-4" aria-hidden="true" />
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => ((settingsOpen = !settingsOpen), (cpOpen = false))}
						title="ตั้งค่า"
					>
						<Settings class="size-4" aria-hidden="true" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						class="hidden lg:inline-flex"
						onclick={() => (railOpen = !railOpen)}
						title={railOpen ? 'ซ่อนแผงฮีโร่' : 'แสดงแผงฮีโร่'}
					>
						<PanelLeft class="size-4" aria-hidden="true" />
					</Button>
				</div>

				{#if cpOpen}
					<CheckpointManager
						campaignId={data.id}
						onclose={() => (cpOpen = false)}
						onrestored={handleCheckpointRestored}
					/>
				{/if}

				{#if settingsOpen}
					<div class="settings-panel panel-enter" role="dialog" aria-label="ตั้งค่า">
						<p class="text-xs font-bold">จำนวนตัวเลือกคำตอบ</p>
						<p class="mt-0.5 text-[11px] text-muted-foreground">
							ชิปทางเลือกหลังจบเทิร์น (0 = ปิด, ค่าเริ่มต้น 3) — พิมพ์อิสระใช้ได้เสมอ
						</p>
						<div class="mt-2 flex items-center gap-2">
							<input
								type="range"
								min="0"
								max="6"
								step="1"
								value={settings.chipCount}
								oninput={(event) => settings.setChipCount(Number(event.currentTarget.value))}
								class="w-full accent-[var(--color-gold)]"
								aria-label="จำนวนตัวเลือกคำตอบ"
							/>
							<span class="w-6 text-center text-sm font-bold tabular-nums"
								>{settings.chipCount}</span
							>
						</div>
					</div>
				{/if}
			</div>

			<div bind:this={narrationEl} class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
				<div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
					{#if session.state}
						<SceneCard state={session.state} />
					{/if}

					{#if session.recap}
						<RecapCard text={session.recap} />
					{/if}

					{#if session.stale}
						<div
							class="rounded-lg border border-muted-foreground/25 bg-muted/30 px-3 py-1.5 text-center text-xs text-muted-foreground"
						>
							⚠ สถานะไม่ได้อัปเดตรอบนี้ — เกมเล่นต่อได้ตามปกติ
						</div>
					{/if}

					{#each session.messages as message (message.id)}
						{#if message.role === 'player' && message.meta?.resolution}
							<div
								class="mx-auto max-w-[90%] rounded-lg border border-xp/30 bg-xp/10 px-3.5 py-1.5 text-center text-xs text-xp"
							>
								🎲 {message.meta.resolution}
							</div>
						{/if}
						<NarrationCard
							content={message.content}
							role={message.role}
							aborted={Boolean(message.meta?.aborted)}
						/>
					{/each}

					{#if session.resolutionLine && session.busy}
						<div
							class="mx-auto max-w-[90%] rounded-lg border border-xp/30 bg-xp/10 px-3.5 py-1.5 text-center text-xs text-xp"
						>
							🎲 {session.resolutionLine}
						</div>
					{/if}

					{#if session.streaming}
						<NarrationCard content={session.streaming} role="gm" streaming />
					{/if}

					{#if session.busy && !session.streaming}
						<div class="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
							<span class="thinking-dot"></span>
							<span class="thinking-dot" style="animation-delay: 0.18s"></span>
							<span class="thinking-dot" style="animation-delay: 0.36s"></span>
							ผู้เล่าเรื่องกำลังคิด...
						</div>
					{/if}

					{#if session.error}
						<div
							class="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-center text-sm text-destructive"
							role="alert"
						>
							{session.error}
						</div>
					{/if}

					<ChoiceChips chips={session.chips} busy={session.busy} onsend={handleSend} />
				</div>
			</div>

			{#if !session.ended}
				{#if levelUpReady}
					<div class="border-t border-xp/40 bg-xp/10 px-4 py-2 sm:px-6">
						<div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
							<p class="text-sm font-semibold text-xp">
								✨ XP เต็ม — {session.state?.hero.name} เก็บระดับได้!
							</p>
							<Button size="sm" onclick={() => (levelUpOpen = true)}>เก็บระดับ</Button>
						</div>
					</div>
				{/if}
				<CommandBar busy={session.busy} onsend={handleSend} onstop={() => void session.stop()} />
			{/if}
		</section>
	</div>
</div>

{#if levelUpReady && levelUpOpen && session.state}
	<LevelUpModal
		world={session.state}
		onapply={handleLevelUp}
		ondismiss={() => (levelUpOpen = false)}
	/>
{/if}

{#if session.ended && session.state}
	<DeathOverlay
		campaignId={data.id}
		world={session.state}
		ended={session.ended}
		onEpilogue={session.writeEpilogue}
	/>
{/if}

<style>
	@keyframes dot-breathe {
		0%,
		100% {
			opacity: 0.25;
			transform: translateY(0);
		}
		50% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}

	.thinking-dot {
		width: 5px;
		height: 5px;
		border-radius: 9999px;
		background: var(--color-gold);
		animation: dot-breathe 1.1s var(--ease-in-out) infinite;
	}

	.rail-enter {
		animation: rail-in 0.25s var(--ease-out) backwards;
	}
	@keyframes rail-in {
		from {
			opacity: 0;
		}
	}

	.settings-panel {
		position: absolute;
		top: 3rem;
		right: 1rem;
		z-index: 30;
		width: 280px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-popover);
		box-shadow: 0 18px 48px oklch(0 0 0 / 50%);
		padding: 0.9rem 1rem;
	}

	.panel-enter {
		animation: rail-in 0.2s var(--ease-out) backwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.thinking-dot {
			animation: none;
			opacity: 0.6;
		}
		.rail-enter,
		.panel-enter {
			animation: none;
		}
	}
</style>
