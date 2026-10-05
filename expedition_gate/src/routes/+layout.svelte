<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import GmStatusChip from '$lib/components/GmStatusChip.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>ประตูนักสำรวจ — Expedition's Gate</title>
	<meta
		name="description"
		content="เกมผจญภัยสวมบทที่ AI เป็นผู้เล่าเรื่อง เล่นบนเครื่องของคุณเอง 100%"
	/>
</svelte:head>

<div class="gate-vignette" aria-hidden="true"></div>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
		<div class="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
			<a
				href="/"
				class="flex items-center gap-2.5 text-foreground transition-opacity duration-150 hover:opacity-85"
			>
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-6 text-ember"
				>
					<!-- ประตู (gate arch) -->
					<path d="M4 20v-9a8 8 0 0 1 16 0v9" />
					<path d="M8 20v-8a4 4 0 0 1 8 0v8" />
					<path d="M2 20h20" />
				</svg>
				<span class="flex flex-col items-start leading-none">
					<span class="text-[15px] font-bold tracking-wide">ประตูนักสำรวจ</span>
					<span
						class="mt-0.5 text-[9px] font-semibold tracking-[0.22em] text-muted-foreground uppercase"
					>
						Expedition's Gate
					</span>
				</span>
			</a>
			<GmStatusChip />
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
