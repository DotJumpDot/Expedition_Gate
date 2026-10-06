<script lang="ts">
	import { goto } from '$app/navigation';
	import { Compass, FileUp, ScrollText, Swords, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import WorldWizard from '$lib/components/WorldWizard.svelte';
	import { SETTING_PRESETS } from '$lib/game/worldstate';

	let {
		data
	}: {
		data: {
			campaigns: Array<{
				id: string;
				title: string;
				setting: string;
				heroName: string | null;
				day: number | null;
				lastPlayedAt: string | null;
			}>;
		};
	} = $props();

	let wizardOpen = $state(false);
	let wizardMode = $state<'scenario' | 'custom'>('scenario');
	let confirmDelete = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();
	let importError = $state('');
	let importing = $state(false);

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

	const SETTING_ICON: Record<string, string> = Object.fromEntries(
		Object.values(SETTING_PRESETS).map((preset) => [preset.key, preset.icon])
	);

	function relativeDate(iso: string | null): string {
		if (!iso) return 'ยังไม่เริ่มเล่น';
		const date = new Date(iso);
		const diffMs = Date.now() - date.getTime();
		const minutes = Math.floor(diffMs / 60_000);
		if (minutes < 1) return 'เมื่อสักครู่';
		if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days} วันที่แล้ว`;
		return date.toLocaleDateString('th-TH');
	}

	async function deleteCampaign(id: string) {
		if (confirmDelete !== id) {
			confirmDelete = id;
			setTimeout(() => (confirmDelete = confirmDelete === id ? null : confirmDelete), 3000);
			return;
		}
		confirmDelete = null;
		await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
		data.campaigns = data.campaigns.filter((campaign) => campaign.id !== id);
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
			<Button
				size="lg"
				class="px-6 text-base"
				onclick={() => ((wizardOpen = true), (wizardMode = 'scenario'))}
			>
				<Swords data-icon="inline-start" aria-hidden="true" />
				เริ่มทันที
			</Button>
			<Button
				variant="outline"
				size="lg"
				onclick={() => ((wizardOpen = true), (wizardMode = 'custom'))}
			>
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

	<section class="gate-rise mt-14 w-full max-w-3xl" style="--stagger: 2">
		{#if data.campaigns.length}
			<div>
				<h2 class="mb-3 text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
					การผจญภัยของคุณ
				</h2>
				<ul class="grid gap-3 sm:grid-cols-2">
					{#each data.campaigns as campaign (campaign.id)}
						<li>
							<a
								href="/campaign/{campaign.id}"
								class="campaign-card group"
								aria-label="เล่นต่อ {campaign.title}"
							>
								<div class="flex items-start gap-3">
									<span class="campaign-icon">{SETTING_ICON[campaign.setting] ?? '🌀'}</span>
									<div class="min-w-0 flex-1">
										<p class="truncate font-bold">{campaign.title}</p>
										<p class="mt-0.5 truncate text-xs text-muted-foreground">
											{campaign.heroName ?? 'ยังไม่มีฮีโร่'}
											{#if campaign.day}
												· วันที่ {campaign.day}
											{/if}
										</p>
										<p class="mt-1.5 text-[11px] text-muted-foreground/80">
											{relativeDate(campaign.lastPlayedAt)}
										</p>
									</div>
									<Swords
										class="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-gold"
										aria-hidden="true"
									/>
								</div>
							</a>
							<div class="-mt-1 flex justify-end">
								<button
									type="button"
									class="delete-btn"
									onclick={(event) => {
										event.preventDefault();
										void deleteCampaign(campaign.id);
									}}
								>
									{#if confirmDelete === campaign.id}
										ยืนยันการลบ?
									{:else}
										<Trash2 class="size-3" aria-hidden="true" /> ลบ
									{/if}
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<div
				class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-10 text-center"
			>
				<ScrollText aria-hidden="true" class="size-7 text-muted-foreground/70" />
				<div>
					<p class="font-semibold">ยังไม่มีการผจญภัย</p>
					<p class="mt-1 text-sm text-muted-foreground">
						การผจญภัยทุกเรื่องของคุณจะถูกบันทึกไว้ที่นี่ — เริ่มเรื่องแรกของคุณเอง
					</p>
				</div>
			</div>
		{/if}
	</section>
</div>

{#if wizardOpen}
	<WorldWizard onclose={() => (wizardOpen = false)} initialMode={wizardMode} />
{/if}

<style>
	.campaign-card {
		display: block;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 85%, transparent);
		background: color-mix(in oklch, var(--color-card) 60%, transparent);
		padding: 0.9rem 1rem;
		transition:
			border-color 0.15s var(--ease-out),
			transform 0.15s var(--ease-out);
	}
	.campaign-card:active {
		transform: scale(0.98);
	}

	.campaign-icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		background: color-mix(in oklch, var(--color-muted) 55%, transparent);
		font-size: 1.1rem;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.25rem;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.68rem;
		color: var(--color-muted-foreground);
		transition: color 0.12s var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.campaign-card:hover {
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
		.delete-btn:hover {
			color: var(--color-destructive);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.campaign-card {
			transition: none;
		}
	}
</style>
