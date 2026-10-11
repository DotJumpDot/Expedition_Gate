<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { Compass, FileUp, Swords } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { SCENARIOS } from '$lib/game/scenarios';

	let fileInput: HTMLInputElement | undefined = $state();
	let importError = $state('');
	let importing = $state(false);

	/** Scene-art manifest entries (available only) — scenario tiles pull art by file. */
	let artByFile = $state<Map<string, string>>(new Map());

	/** Most recent open campaign — the เล่นต่อ tile on the gate. */
	let lastPlayed = $state<{
		id: string;
		title: string;
		heroName: string | null;
		lastPlayedAt: string | null;
	} | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/scenes', { cache: 'no-store' });
			const data = (await res.json()) as {
				scenes: Array<{ file: string; url: string; available: boolean }>;
			};
			artByFile = new Map(
				data.scenes.filter((scene) => scene.available).map((scene) => [scene.file, scene.url])
			);
		} catch {
			artByFile = new Map();
		}
		try {
			const res = await fetch('/api/campaigns', { cache: 'no-store' });
			const data = (await res.json()) as {
				campaigns: Array<{
					id: string;
					title: string;
					heroName: string | null;
					lastPlayedAt: string | null;
				}>;
			};
			lastPlayed = data.campaigns[0] ?? null; // list is sorted most-recent-first
		} catch {
			lastPlayed = null;
		}
	});

	function relativeDate(iso: string | null): string {
		if (!iso) return '';
		const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
		if (minutes < 1) return 'เมื่อสักครู่';
		if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days} วันที่แล้ว`;
		return new Date(iso).toLocaleDateString('th-TH');
	}

	async function onImportFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		importing = true;
		importError = '';
		try {
			const text = await file.text();
			const res = await fetch('/api/campaigns/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: text
			});
			const body = (await res.json()) as { id?: string; error?: string };
			if (!res.ok || !body.id) throw new Error(body.error ?? 'นำเข้าไม่สำเร็จ');
			await goto(`/campaign/${body.id}`);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ';
			importing = false;
		} finally {
			input.value = '';
		}
	}
</script>

<svelte:head>
	<title>ประตูนักสำรวจ — เลือกการผจญภัยของคุณ</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
	<section class="gate-rise flex flex-col items-center text-center" style="--stagger: 0">
		<h1 class="max-w-2xl text-4xl leading-[1.15] font-bold tracking-tight text-balance sm:text-5xl">
			ก้าวผ่านประตู
			<span class="text-primary">สู่การผจญภัยไร้ขอบเขต</span>
		</h1>
		<p class="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
			ผู้เล่าเรื่อง AI เป็นทั้งผู้เล่า กรรมการ และตัวละครทุกตัวในเรื่อง — จะเดินเรื่องแบบไหนก็ได้
			โลกจำเรื่องของคุณได้ และผลลัพธ์ทุกอย่างคงอยู่ เล่นได้เฉพาะบนเครื่องของคุณเอง 100%
		</p>
	</section>

	<section class="gate-rise mt-9 flex flex-col items-center gap-2" style="--stagger: 1">
		<div class="flex flex-wrap items-center justify-center gap-2">
			<Button size="lg" class="px-6 text-base" href="/adventures/new">
				<Swords data-icon="inline-start" aria-hidden="true" />
				เริ่มทันที
			</Button>
			<Button variant="outline" size="lg" href="/adventures/new?mode=custom">
				<Compass data-icon="inline-start" aria-hidden="true" />
				สร้างโลกใหม่
			</Button>
			<Button
				variant="outline"
				size="lg"
				onclick={() => fileInput?.click()}
				disabled={importing}
				title="นำเข้าการผจญภัยจากไฟล์ .json"
			>
				<FileUp data-icon="inline-start" aria-hidden="true" />
				{importing ? 'กำลังนำเข้า...' : 'นำเข้า'}
			</Button>
			<input
				type="file"
				accept=".json,application/json"
				class="hidden"
				bind:this={fileInput}
				onchange={onImportFile}
			/>
		</div>
		{#if importError}
			<p class="text-sm text-destructive" role="alert">{importError}</p>
		{/if}
	</section>

	<!-- เล่นต่อ — jump straight back into the most recent adventure -->
	{#if lastPlayed}
		<section class="gate-rise mt-8 w-full" style="--stagger: 1.5">
			<a
				href="/campaign/{lastPlayed.id}"
				class="continue-tile group"
				aria-label="เล่นต่อ {lastPlayed.title}"
			>
				<span class="continue-pulse" aria-hidden="true"></span>
				<div class="min-w-0 flex-1">
					<p class="text-[11px] font-bold tracking-[0.18em] text-gold uppercase">เล่นต่อ</p>
					<p class="mt-0.5 truncate text-sm font-bold">{lastPlayed.title}</p>
					<p class="mt-0.5 truncate text-xs text-muted-foreground">
						{lastPlayed.heroName ?? 'ยังไม่มีฮีโร่'}{lastPlayed.lastPlayedAt
							? ` · ${relativeDate(lastPlayed.lastPlayedAt)}`
							: ''}
					</p>
				</div>
				<Swords
					class="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-gold"
					aria-hidden="true"
				/>
			</a>
		</section>
	{/if}

	<!-- เรื่องพร้อมเล่น — rich scenario tiles with scene art -->
	<section class="gate-rise mt-14 w-full" style="--stagger: 2">
		<div class="mb-3 flex items-baseline justify-between gap-3">
			<h2 class="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
				เรื่องพร้อมเล่น — เลือกแล้วเข้าเกมทันที
			</h2>
			<a
				href="/adventures"
				class="shrink-0 text-xs text-muted-foreground transition-colors hover:text-gold"
			>
				การผจญภัยของคุณ →
			</a>
		</div>
		<ul class="grid gap-3.5 md:grid-cols-2">
			{#each SCENARIOS as scenario (scenario.id)}
				{@const art = artByFile.get(scenario.image)}
				<li>
					<a href="/adventures/new?scenario={scenario.id}" class="scenario-tile group">
						{#if art}
							<div
								class="tile-art"
								style="background-image: url({art})"
								in:fade={{ duration: 500 }}
								aria-hidden="true"
							></div>
						{:else}
							<span class="tile-fallback" aria-hidden="true">{scenario.icon}</span>
						{/if}
						<span class="tile-body">
							<span class="block text-[15px] font-bold text-gold">{scenario.title}</span>
							<span class="mt-1 block text-xs leading-relaxed text-muted-foreground"
								>{scenario.tagline}</span
							>
							<span
								class="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80"
							>
								<Swords class="size-3" aria-hidden="true" />
								{scenario.heroes.length} ฮีโร่พร้อมเล่น · เริ่มได้ทันที
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<section class="gate-rise mt-10 w-full text-center" style="--stagger: 3">
		<p class="text-xs text-muted-foreground">
			อยากสร้างโลกของตัวเอง?
			<a href="/adventures/new?mode=custom" class="text-gold transition-opacity hover:opacity-80"
				>สร้างโลกใหม่จากพรีเซ็ต →</a
			>
		</p>
	</section>
</div>

<style>
	.continue-tile {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		width: 100%;
		max-width: 34rem;
		margin-inline: auto;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-gold) 35%, transparent);
		background: color-mix(in oklch, var(--color-card) 65%, transparent);
		padding: 0.8rem 1rem;
		transition:
			border-color 0.15s var(--ease-out),
			transform 0.15s var(--ease-out);
	}
	.continue-tile:active {
		transform: scale(0.985);
	}
	.continue-pulse {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		animation: continue-glow 2.6s ease-in-out infinite;
	}
	@keyframes continue-glow {
		0%,
		100% {
			box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-gold) 14%, transparent);
		}
		50% {
			box-shadow: 0 0 18px 0 color-mix(in oklch, var(--color-gold) 14%, transparent);
		}
	}

	.scenario-tile {
		position: relative;
		display: block;
		overflow: hidden;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 85%, transparent);
		background: color-mix(in oklch, var(--color-card) 65%, transparent);
		min-height: 128px;
		transition:
			border-color 0.15s var(--ease-out),
			transform 0.15s var(--ease-out);
	}
	.scenario-tile:active {
		transform: scale(0.985);
	}

	/* Scene art = background, LEFT 50% only, fading out toward the chip's center —
	   text lives on the right half in normal colors. */
	.tile-art {
		position: absolute;
		inset: 0 auto 0 0;
		width: 55%;
		background-size: cover;
		background-position: center;
		opacity: 0.9;
		-webkit-mask-image: linear-gradient(to right, black 30%, transparent 98%);
		mask-image: linear-gradient(to right, black 30%, transparent 98%);
	}

	.tile-fallback {
		position: absolute;
		inset: 0 auto 0 0;
		display: grid;
		place-items: center;
		width: 30%;
		font-size: 2rem;
		opacity: 0.5;
		-webkit-mask-image: linear-gradient(to right, black 40%, transparent 98%);
		mask-image: linear-gradient(to right, black 40%, transparent 98%);
	}

	.tile-body {
		position: relative;
		display: block;
		padding: 1rem 1.1rem 1rem 47%;
		min-height: 128px;
	}

	@media (max-width: 480px) {
		/* Narrow screens stack: art becomes a top band fading DOWN into the
		   text, so long titles and taglines get the full width. */
		.tile-art {
			inset: 0 0 auto 0;
			width: 100%;
			height: 112px;
			-webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
			mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
		}
		.tile-fallback {
			inset: 0 0 auto 0;
			width: 100%;
			height: 112px;
			-webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
			mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
		}
		.tile-body {
			margin-top: 72px;
			padding: 0.15rem 1rem 0.9rem;
			min-height: 0;
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.scenario-tile:hover {
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
		.scenario-tile:hover .tile-art {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scenario-tile {
			transition: none;
		}
		.continue-pulse {
			animation: none;
			box-shadow: none;
		}
		.continue-tile {
			transition: none;
		}
	}
</style>
