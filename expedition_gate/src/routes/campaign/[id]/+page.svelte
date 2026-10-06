<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Download from '@lucide/svelte/icons/download';
	import History from '@lucide/svelte/icons/history';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import Settings from '@lucide/svelte/icons/settings';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ChoiceChips from '$lib/components/game/ChoiceChips.svelte';
	import CheckpointManager from '$lib/components/game/CheckpointManager.svelte';
	import CommandBar from '$lib/components/game/CommandBar.svelte';
	import DeathOverlay from '$lib/components/game/DeathOverlay.svelte';
	import HeroSheet from '$lib/components/game/HeroSheet.svelte';
	import LevelUpModal from '$lib/components/game/LevelUpModal.svelte';
	import NarrationCard from '$lib/components/game/NarrationCard.svelte';
	import NpcPanel from '$lib/components/game/NpcPanel.svelte';
	import QuestList from '$lib/components/game/QuestList.svelte';
	import WorldCodex from '$lib/components/game/WorldCodex.svelte';
	import RecapCard from '$lib/components/game/RecapCard.svelte';
	import SceneCard from '$lib/components/game/SceneCard.svelte';
	import { session } from '$lib/stores/campaign.svelte';
	import { settings, LENGTH_HINTS, type NarrationLength } from '$lib/stores/settings.svelte';
	import type { StatKey, Stats } from '$lib/game/rules';
	import { STAT_LABELS_TH, xpToNext } from '$lib/game/rules';

	let { data }: { data: { id: string; title: string; ended: string | null } } = $props();

	let railOpen = $state(true);
	let mobileRailOpen = $state(false);
	let cpOpen = $state(false);
	let settingsOpen = $state(false);
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
		void session.send(
			'reroll',
			'ใช้แต้มดวง — ทอยเช็ค ' + STAT_LABELS_TH[target.stat] + ' (DC ' + target.dc + ') ใหม่',
			target.stat,
			target.dc
		);
	}

	function handleUseItem(name: string) {
		void session.send('use-item', 'ใช้ ' + name, undefined, undefined, name);
	}

	function handleSend(
		kind: Parameters<typeof session.send>[0],
		text: string,
		stat?: StatKey,
		dc?: number
	) {
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

	<div class="flex min-h-0 flex-1">
		<!-- Left rail: hero sheet + NPCs + quests (collapsible on desktop) -->
		{#if railOpen}
			<aside
				class="rail-enter hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border/60 bg-sidebar/40 px-4 py-5 lg:flex"
			>
				{#if session.state}
					<HeroSheet world={session.state} disabled={session.busy} onuseitem={handleUseItem} />
					<NpcPanel world={session.state} />
					<QuestList world={session.state} />
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
					<HeroSheet world={session.state} disabled={session.busy} onuseitem={handleUseItem} />
					<NpcPanel world={session.state} />
					<QuestList world={session.state} />
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
							onclick={() => ((codexOpen = !codexOpen), (cpOpen = false), (settingsOpen = false))}
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
							onclick={() => ((cpOpen = !cpOpen), (settingsOpen = false))}
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

						<hr class="my-3 border-border/60" />

						<p class="text-xs font-bold">ความยาวบทเล่า</p>
						<div class="mt-1.5 flex gap-1.5">
							{#each Object.entries(LENGTH_HINTS) as [value] (value)}
								<button
									type="button"
									class="seg-btn {settings.narrationLength === value ? 'seg-active' : ''}"
									onclick={() => settings.setNarrationLength(value as NarrationLength)}
								>
									{value === 'short' ? 'สั้น' : value === 'medium' ? 'กลาง' : 'ยาว'}
								</button>
							{/each}
						</div>
						<p class="mt-1 text-[10px] text-muted-foreground">
							{LENGTH_HINTS[settings.narrationLength]}
						</p>

						<hr class="my-3 border-border/60" />

						<label class="flex cursor-pointer items-center justify-between gap-2 text-xs font-bold">
							บล็อก 📊 สถานะท้ายบท
							<input
								type="checkbox"
								checked={!settings.extrasOff}
								onchange={(event) => settings.setExtrasOff(!event.currentTarget.checked)}
								class="size-4 accent-[var(--color-gold)]"
							/>
						</label>
						<p class="mt-0.5 text-[10px] text-muted-foreground">
							ปิด = ผู้เล่าเรื่องจะไม่สรุปตัวเลขท้ายบทอีกต่อไป
						</p>

						<hr class="my-3 border-border/60" />

						<label class="block text-xs font-bold" for="gm-url">GM URL (llama-server)</label>
						<p class="mt-0.5 text-[10px] text-muted-foreground">
							ต้องเป็นเครื่องนี้หรือวงแลนเท่านั้น — เว้นว่างเพื่อใช้ค่าเริ่มต้นของเซิร์ฟเวอร์
						</p>
						<Input
							id="gm-url"
							placeholder="http://127.0.0.1:8080/v1"
							class="mt-1.5 h-8 text-xs"
							value={settings.modelUrl}
							onchange={(event) => settings.setModelUrl(event.currentTarget.value)}
						/>

						<hr class="my-3 border-border/60" />

						<label class="block text-xs font-bold" for="gm-override">โน้ตถึงผู้เล่าเรื่อง</label>
						<p class="mt-0.5 text-[10px] text-muted-foreground">
							คำสั่งพิเศษที่ทับกฎในระบบทั้งหมด (แทรกท้าย prompt ทุกเทิร์น) เช่น
							"เล่าจากมุมมองบุรุษที่ 2"
						</p>
						<textarea
							id="gm-override"
							class="mt-1.5 w-full rounded-md border border-input bg-input/30 px-2 py-1.5 text-xs leading-relaxed"
							rows="3"
							maxlength="2000"
							placeholder="เขียนคำสั่งพิเศษสำหรับ GM ที่นี่..."
							value={settings.gmOverride}
							onchange={(event) => settings.setGmOverride(event.currentTarget.value)}></textarea>
					</div>
				{/if}
			</div>

			<div bind:this={narrationEl} class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
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
							<div
								class="resolution-chip mx-auto max-w-[90%] rounded-lg border border-xp/30 bg-xp/10 px-3.5 py-1.5 text-center text-xs text-xp"
							>
								<span class="res-dice" aria-hidden="true">🎲</span>
								{message.meta.resolution}
							</div>
						{/if}
						<NarrationCard
							content={message.content}
							role={message.role}
							aborted={Boolean(message.meta?.aborted)}
							cjkLeak={Boolean(message.meta?.cjkLeak)}
						/>
					{/each}

					{#if session.resolutionLine && session.busy}
						<div
							class="resolution-chip mx-auto max-w-[90%] rounded-lg border border-xp/30 bg-xp/10 px-3.5 py-1.5 text-center text-xs text-xp"
						>
							<span class="res-dice" aria-hidden="true">🎲</span>
							{session.resolutionLine}
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

	.settings-panel {
		position: absolute;
		top: 3rem;
		right: 1rem;
		z-index: 30;
		width: 300px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-popover);
		box-shadow: 0 18px 48px oklch(0 0 0 / 50%);
		padding: 0.9rem 1rem;
		max-height: calc(100vh - 6rem);
		overflow-y: auto;
	}

	.panel-enter {
		animation: rail-in 0.2s var(--ease-out) backwards;
	}

	/* The resolution chip's die tumbles in exactly once. */
	@keyframes res-dice-in {
		from {
			transform: rotate(-180deg) scale(0.6);
		}
	}
	.res-dice {
		display: inline-block;
		animation: res-dice-in 0.45s var(--ease-out) backwards;
	}

	.seg-btn {
		flex: 1;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.28rem 0.4rem;
		font-size: 0.75rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
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
	.seg-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
		font-weight: 600;
	}

	.drawer-scrim {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: oklch(0.1 0.01 75 / 55%);
		backdrop-filter: blur(3px);
	}

	@media (prefers-reduced-motion: reduce) {
		.thinking-dot {
			animation: none;
			opacity: 0.6;
		}
		.rail-enter,
		.panel-enter,
		.res-dice {
			animation: none;
		}
		.seg-btn {
			transition: none;
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
