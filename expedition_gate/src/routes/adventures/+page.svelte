<script lang="ts">
	import { Compass, ScrollText, Swords, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
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

	let confirmDelete = $state<string | null>(null);

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
	<title>การผจญภัยของคุณ — ประตูนักสำรวจ</title>
</svelte:head>

<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
	<header class="flex items-center justify-between gap-3">
		<h1 class="text-lg font-bold">การผจญภัยของคุณ</h1>
		<Button variant="outline" size="sm" href="/adventures/new">
			<Compass data-icon="inline-start" aria-hidden="true" />
			สร้างใหม่
		</Button>
	</header>

	{#if data.campaigns.length}
		<ul class="mt-5 grid gap-3 sm:grid-cols-2">
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
	{:else}
		<div
			class="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center"
		>
			<ScrollText aria-hidden="true" class="size-7 text-muted-foreground/70" />
			<div>
				<p class="font-semibold">ยังไม่มีการผจญภัย</p>
				<p class="mt-1 text-sm text-muted-foreground">
					การผจญภัยทุกเรื่องของคุณจะถูกบันทึกไว้ที่นี่ — กลับหน้าแรกเพื่อเริ่มเรื่องแรก
				</p>
			</div>
			<Button size="sm" href="/">กลับหน้าแรก</Button>
		</div>
	{/if}
</div>

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
