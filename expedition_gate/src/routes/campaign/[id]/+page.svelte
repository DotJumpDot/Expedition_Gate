<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import CommandBar from '$lib/components/game/CommandBar.svelte';
	import HeroSheet from '$lib/components/game/HeroSheet.svelte';
	import NarrationCard from '$lib/components/game/NarrationCard.svelte';
	import QuestList from '$lib/components/game/QuestList.svelte';
	import SceneCard from '$lib/components/game/SceneCard.svelte';
	import { session } from '$lib/stores/campaign.svelte';
	import type { StatKey } from '$lib/server/engine/rules';

	let { data }: { data: { id: string; title: string } } = $props();

	let railOpen = $state(true);
	let narrationEl: HTMLElement | undefined = $state();

	onMount(async () => {
		const ok = await session.load(data.id);
		if (ok && session.messages.length === 0) {
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

	function handleSend(
		kind: Parameters<typeof session.send>[0],
		text: string,
		stat?: StatKey,
		dc?: number
	) {
		void session.send(kind, text, stat, dc);
	}
</script>

<svelte:head>
	<title>{data.title} — ประตูนักสำรวจ</title>
</svelte:head>

<div class="flex h-[calc(100vh-3.5rem)] flex-col">
	<div class="flex min-h-0 flex-1">
		<!-- Left rail: hero sheet + quests (collapsible) -->
		{#if railOpen}
			<aside
				class="msg-enter hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border/60 bg-sidebar/40 px-4 py-5 lg:flex"
			>
				{#if session.state}
					<HeroSheet state={session.state} />
					<QuestList state={session.state} />
				{/if}
			</aside>
		{/if}

		<!-- Center: scene + narration + command bar -->
		<section class="flex min-h-0 min-w-0 flex-1 flex-col">
			<div class="flex items-center gap-2 border-b border-border/60 px-4 py-2 sm:px-6">
				<Button variant="ghost" size="sm" href="/">
					<ChevronLeft class="size-4" aria-hidden="true" />
					ประตู
				</Button>
				<h1 class="truncate text-sm font-bold">{data.title}</h1>
				<Button
					variant="ghost"
					size="icon-sm"
					class="ml-auto hidden lg:inline-flex"
					onclick={() => (railOpen = !railOpen)}
					title={railOpen ? 'ซ่อนแผงฮีโร่' : 'แสดงแผงฮีโร่'}
				>
					<PanelLeft class="size-4" aria-hidden="true" />
				</Button>
			</div>

			<div bind:this={narrationEl} class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
				<div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
					{#if session.state}
						<SceneCard state={session.state} />
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
				</div>
			</div>

			<CommandBar busy={session.busy} onsend={handleSend} onstop={() => void session.stop()} />
		</section>
	</div>
</div>

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

	@media (prefers-reduced-motion: reduce) {
		.thinking-dot {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
