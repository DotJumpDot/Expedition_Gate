<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Download from '@lucide/svelte/icons/download';
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
	import ResolutionChip from '$lib/components/game/ResolutionChip.svelte';
	import WorldCodex from '$lib/components/game/WorldCodex.svelte';
	import RecapCard from '$lib/components/game/RecapCard.svelte';
	import SceneCard from '$lib/components/game/SceneCard.svelte';
	import { session } from '$lib/stores/campaign.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { StatKey, Stats } from '$lib/game/rules';
	import { STAT_LABELS_TH, xpToNext } from '$lib/game/rules';

	let { data }: { data: { id: string; title: string; ended: string | null } } = $props();

	let railOpen = $state(true);
	let mobileRailOpen = $state(false);
	let cpOpen = $state(false);
	let codexOpen = $state(false);
	let levelUpOpen = $state(false);
	let narrationEl: HTMLElement | undefined = $state();

	onMount(async () => {
		const ok = await session.load(data.id);
		if (ok && session.messages.length === 0 && !session.ended) {
			void session.send('opening');
		}
	});

	function updateOnline() {
		session.setOffline(navigator.onLine === false);
	}

	// Follow the story only while the reader is AT the bottom — scrolling up
	// to reread must survive the stream (and jump back on the next send).
	let stickToBottom = true;

	function handleNarrationScroll() {
		const el = narrationEl;
		if (!el) return;
		stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
	}

	$effect(() => {
		void session.messages.length;
		void session.streaming;
		if (narrationEl && stickToBottom) {
			narrationEl.scrollTo({ top: narrationEl.scrollHeight });
		}
	});

	const levelUpReady = $derived(
		Boolean(session.state) &&
			!session.ended &&
			session.state!.hero.xp >= xpToNext(session.state!.hero.level)
	);

	interface RollRecord {
		kind: string;
		stat?: StatKey;
		detail?: { dc?: number };
	}

	/**
	 * แต้มดวง target: the check on the LAST completed turn (a saved GM reply
	 * preceded by a player message carrying a check roll). Rerolls of older
	 * rolls are deliberately not offered — narratively they'd be retcons.
	 */
	function computeRerollTarget(): { stat: StatKey; dc: number } | null {
		const msgs = session.messages;
		if (msgs.length < 2) return null;
		const last = msgs[msgs.length - 1];
		if (last.role !== 'gm' || last.meta?.aborted) return null;
		const player = msgs[msgs.length - 2];
		if (player.role !== 'player') return null;
		const dice = player.meta?.dice as RollRecord[] | undefined;
		const hit = dice?.find(
			(record) => record.kind === 'check' && record.stat && typeof record.detail?.dc === 'number'
		);
		if (!hit || !hit.stat || typeof hit.detail?.dc !== 'number') return null;
		return { stat: hit.stat, dc: hit.detail.dc };
	}

	const rerollTarget = $derived(computeRerollTarget());
	const canReroll = $derived(
		rerollTarget !== null &&
			!session.busy &&
			!session.ended &&
			session.state !== null &&
			session.state.hero.luckPoints > 0
	);

	function handleReroll(target: { stat: StatKey; dc: number }) {
		stickToBottom = true;
		void session.send(
			'reroll',
			'ใช้แต้มดวง — ทอยเช็ค ' + STAT_LABELS_TH[target.stat] + ' (DC ' + target.dc + ') ใหม่',
			target.stat,
			target.dc
		);
	}

	function handleUseItem(name: string) {
		stickToBottom = true;
		void session.send('use-item', 'ใช้ ' + name, undefined, undefined, name);
	}

	function handleSend(
		kind: Parameters<typeof session.send>[0],
		text: string,
		stat?: StatKey,
		dc?: number
	) {
		stickToBottom = true;
		void session.send(kind, text, stat, dc);
	}

	function handleCheckpointRestored() {
		// keep the panel open — it now shows the auto-snapshot of the abandoned branch
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

<svelte:window ononline={updateOnline} onoffline={updateOnline} />

<div class="relative flex h-[calc(100vh-3.5rem)] flex-col">
	{#if session.offline}
		<div
			class="border-b border-destructive/40 bg-destructive/15 px-4 py-1.5 text-center text-xs text-destructive"
			role="alert"
		>
			⚠ การเชื่อมต่อขาดหาย — รอสักครู่แล้วเล่นต่อได้ (ความคืบหน้าถูกบันทึกทุกเทิร์น)
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 {settings.heroSide === 'right' ? 'flex-row-reverse' : ''}">
		<!-- Hero rail: hero sheet + quests + NPCs (side + collapse configurable) -->
		{#if railOpen}
			<aside
				class="rail-enter hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-border/60 bg-sidebar/40 px-4 py-5 lg:flex {settings.heroSide ===
				'right'
					? 'border-l'
					: 'border-r'}"
			>
				{#if session.state}
					<HeroSheet
						world={session.state}
						campaignId={data.id}
						disabled={session.busy}
						onuseitem={handleUseItem}
					/>
					<QuestList world={session.state} />
					<NpcPanel world={session.state} />
				{/if}
			</aside>
		{/if}

		<!-- Mobile rail drawer -->
		{#if mobileRailOpen}
			<button class="drawer-scrim" aria-label="ปิดแผงฮีโร่" onclick={() => (mobileRailOpen = false)}
			></button>
			<aside
				class="drawer-enter fixed inset-y-0 top-14 left-0 z-40 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto border-r border-border/60 bg-popover px-4 py-5 shadow-2xl lg:hidden"
			>
				{#if session.state}
					<HeroSheet
						world={session.state}
						campaignId={data.id}
						disabled={session.busy}
						onuseitem={handleUseItem}
					/>
					<QuestList world={session.state} />
					<NpcPanel world={session.state} />
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
					<Button
						variant="ghost"
						size="icon-sm"
						class="lg:hidden"
						onclick={() => (mobileRailOpen = !mobileRailOpen)}
						title="แผงฮีโร่"
					>
						<PanelLeft class="size-4" aria-hidden="true" />
					</Button>
					{#if session.state}
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => ((codexOpen = !codexOpen), (cpOpen = false))}
							title="บันทึกแห่งโลก"
						>
							<BookOpen class="size-4" aria-hidden="true" />
						</Button>
					{/if}
					{#if !session.ended}
						<Button
							variant="ghost"
							size="icon-sm"
							class="hidden lg:inline-flex"
							onclick={() => (cpOpen = !cpOpen)}
							title="จุดบันทึก"
						>
							<History class="size-4" aria-hidden="true" />
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="icon-sm"
						href={`/api/campaigns/${data.id}/export`}
						title="ส่งออกการผจญภัย (.json)"
					>
						<Download class="size-4" aria-hidden="true" />
					</Button>
					<Button variant="ghost" size="icon-sm" href="/settings" title="ตั้งค่า">
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

				{#if codexOpen && session.state}
					<WorldCodex world={session.state} onclose={() => (codexOpen = false)} />
				{/if}

				{#if cpOpen}
					<CheckpointManager
						campaignId={data.id}
						onclose={() => (cpOpen = false)}
						onrestored={handleCheckpointRestored}
					/>
				{/if}
			</div>

			<div
				bind:this={narrationEl}
				class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
				onscroll={handleNarrationScroll}
			>
				<div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
					{#if session.state}
						<SceneCard world={session.state} setting={session.setting} campaignId={data.id} />
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
							<ResolutionChip
								resolution={String(message.meta.resolution)}
								dice={message.meta.dice as unknown[] | undefined}
							/>
						{/if}
						<NarrationCard
							content={message.content}
							role={message.role}
							aborted={Boolean(message.meta?.aborted)}
							cjkLeak={Boolean(message.meta?.cjkLeak)}
						/>
					{/each}

					{#if session.resolutionLine && session.busy}
						<ResolutionChip resolution={session.resolutionLine} live />
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

					{#if canReroll && rerollTarget}
						<div class="flex justify-center">
							<button
								type="button"
								class="luck-btn"
								onclick={() => handleReroll(rerollTarget)}
								title="ใช้ 1 แต้มดวงเพื่อทอยเช็คล่าสุดใหม่ (เหลือ {session.state?.hero
									.luckPoints} แต้ม)"
							>
								<span aria-hidden="true">🎲</span>
								ใช้แต้มดวง 1 แต้ม — ทอยเช็ค {STAT_LABELS_TH[rerollTarget.stat]} (DC {rerollTarget.dc})
								ใหม่
							</button>
						</div>
					{/if}

					<ChoiceChips
						chips={session.chips}
						busy={session.busy}
						major={Boolean(session.state?.majorDecision)}
						onsend={handleSend}
					/>
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

	/* แต้มดวง reroll — a gold-tinged offer, press feedback only. */
	.luck-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-gold) 35%, transparent);
		background: color-mix(in oklch, var(--color-gold) 8%, transparent);
		padding: 0.4rem 1rem;
		font-size: 0.8rem;
		color: var(--color-gold);
		transition:
			transform 0.12s var(--ease-out),
			background-color 0.15s var(--ease-out),
			border-color 0.15s var(--ease-out);
	}
	.luck-btn:active {
		transform: scale(0.96);
	}

	.drawer-scrim {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: color-mix(in oklch, var(--color-background) 55%, black);
		backdrop-filter: blur(3px);
	}

	@media (prefers-reduced-motion: reduce) {
		.thinking-dot {
			animation: none;
			opacity: 0.6;
		}
		.rail-enter {
			animation: none;
		}
		.luck-btn {
			transition: none;
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.luck-btn:hover {
			background: color-mix(in oklch, var(--color-gold) 14%, transparent);
			border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		}
	}
</style>
