<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import GmStatusChip from '$lib/components/GmStatusChip.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Reading preferences (ตั้งค่า → การแสดงผล): theme, font family + UI scale,
	// applied at the document root so everything follows the choice.
	$effect(() => {
		document.documentElement.dataset.theme = settings.theme;
		document.documentElement.style.setProperty('--font-sans', settings.fontStack());
		document.documentElement.style.fontSize = `${(settings.fontScale / 100) * 16}px`;
	});
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
			<div class="flex items-center gap-1.5">
				<a
					href="/adventures"
					class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
					title="การผจญภัยของคุณ"
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4"
					>
						<!-- crossed swords (adventures) -->
						<path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
						<path d="m13 19 6-6" />
						<path d="m16 16 4 4" />
						<path d="m19 21 2-2" />
						<path d="M9.5 14.5 21 3v3L9.5 17.5" />
						<path d="m5 14-4 4" />
						<path d="m7 17-4 4" />
					</svg>
					<span class="hidden sm:inline">การผจญภัย</span>
				</a>
				<GmStatusChip />
				<a
					href="/settings"
					class="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
					title="ตั้งค่า"
					aria-label="ตั้งค่า"
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4.5"
					>
						<!-- gear (settings) -->
						<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
						<path
							d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"
						/>
					</svg>
				</a>
			</div>
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
