<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		settings,
		LENGTH_HINTS,
		FONT_OPTIONS,
		type NarrationLength,
		type FontKey,
		type HeroSide
	} from '$lib/stores/settings.svelte';

	const SECTIONS = [
		{ id: 'display', label: 'การแสดงผล' },
		{ id: 'narration', label: 'การเล่าเรื่อง' },
		{ id: 'gm', label: 'ผู้เล่าเรื่อง (โมเดล)' },
		{ id: 'gm-note', label: 'โน้ตถึงผู้เล่าเรื่อง' }
	];

	function jump(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>ตั้งค่า — ประตูนักสำรวจ</title>
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href="/" class="-ml-2">
			<ChevronLeft class="size-4" aria-hidden="true" />
			กลับ
		</Button>
		<h1 class="text-lg font-bold">ตั้งค่า</h1>
	</div>

	<div class="mt-6 grid gap-8 lg:grid-cols-[190px_1fr]">
		<!-- Section nav (CometStream-style) -->
		<nav class="top-24 self-start lg:sticky" aria-label="หมวดการตั้งค่า">
			<ul class="flex gap-1.5 overflow-x-auto lg:flex-col">
				{#each SECTIONS as section (section.id)}
					<li>
						<button type="button" class="nav-link" onclick={() => jump(section.id)}>
							{section.label}
						</button>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="min-w-0 space-y-6">
			<!-- ============ การแสดงผล ============ -->
			<section id="display" class="settings-card scroll-mt-24">
				<h2 class="settings-h2">การแสดงผล</h2>

				<div class="mt-4 space-y-5">
					<div>
						<p class="settings-label">ฟอนต์อ่านเรื่อง</p>
						<p class="settings-hint">ฟอนต์หลักของทั้งเกม — เลือกตามสบายตา</p>
						<div class="mt-2 grid gap-1.5 sm:grid-cols-2">
							{#each FONT_OPTIONS as option (option.key)}
								<button
									type="button"
									class="font-opt {settings.fontKey === option.key ? 'font-opt-active' : ''}"
									style="font-family: {option.stack}"
									onclick={() => settings.setFontKey(option.key as FontKey)}
								>
									<span class="flex items-center gap-2">
										<span
											class="opt-dot {settings.fontKey === option.key ? 'opt-dot-on' : ''}"
											aria-hidden="true"
										></span>
										{option.labelTh}
									</span>
									<span class="mt-1 block pl-5 text-[0.95em] opacity-75">
										ทดสอบ: ดาบและเวทมนตร์ HP 42/42 — สายหมอกหนาทึบ
									</span>
								</button>
							{/each}
						</div>
					</div>

					<div>
						<p class="settings-label">ขนาดตัวอักษร</p>
						<p class="settings-hint">ย่อ/ขยายทั้งหน้าจอ ({settings.fontScale}%)</p>
						<div class="mt-2 flex items-center gap-3">
							<span class="text-xs text-muted-foreground">เล็ก</span>
							<input
								type="range"
								min="85"
								max="140"
								step="5"
								value={settings.fontScale}
								oninput={(event) => settings.setFontScale(Number(event.currentTarget.value))}
								class="flex-1 accent-[var(--color-gold)]"
								aria-label="ขนาดตัวอักษร"
							/>
							<span class="text-xs text-muted-foreground">ใหญ่</span>
							<span class="w-12 text-center text-sm font-bold tabular-nums"
								>{settings.fontScale}%</span
							>
						</div>
					</div>

					<div>
						<p class="settings-label">ตำแหน่งแผงฮีโร่</p>
						<p class="settings-hint">ฝั่งที่ตารางสถิตะ ไอเทม และเควสอยู่</p>
						<div class="mt-2 flex gap-1.5">
							<button
								type="button"
								class="seg-btn {settings.heroSide === 'left' ? 'seg-active' : ''}"
								onclick={() => settings.setHeroSide('left' as HeroSide)}
							>
								ฝั่งซ้าย
							</button>
							<button
								type="button"
								class="seg-btn {settings.heroSide === 'right' ? 'seg-active' : ''}"
								onclick={() => settings.setHeroSide('right' as HeroSide)}
							>
								ฝั่งขวา
							</button>
						</div>
					</div>
				</div>
			</section>

			<!-- ============ การเล่าเรื่อง ============ -->
			<section id="narration" class="settings-card scroll-mt-24">
				<h2 class="settings-h2">การเล่าเรื่อง</h2>

				<div class="mt-4 space-y-5">
					<div>
						<p class="settings-label">ความยาวบทเล่า</p>
						<div class="mt-2 flex gap-1.5">
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
						<p class="mt-1.5 text-[11px] text-muted-foreground">
							{LENGTH_HINTS[settings.narrationLength]}
						</p>
					</div>

					<div>
						<p class="settings-label">จำนวนตัวเลือกคำตอบ (ชิปทางเลือก)</p>
						<p class="settings-hint">หลังจบเทิร์น 0 = ปิด — พิมพ์อิสระใช้ได้เสมอ</p>
						<div class="mt-2 flex items-center gap-3">
							<input
								type="range"
								min="0"
								max="6"
								step="1"
								value={settings.chipCount}
								oninput={(event) => settings.setChipCount(Number(event.currentTarget.value))}
								class="flex-1 accent-[var(--color-gold)]"
								aria-label="จำนวนตัวเลือกคำตอบ"
							/>
							<span class="w-6 text-center text-sm font-bold tabular-nums"
								>{settings.chipCount}</span
							>
						</div>
					</div>

					<label class="flex cursor-pointer items-center justify-between gap-3">
						<span>
							<span class="settings-label block">บล็อก 📊 สถานะท้ายบท</span>
							<span class="settings-hint">ปิด = ผู้เล่าเรื่องจะไม่สรุปตัวเลขท้ายบท</span>
						</span>
						<input
							type="checkbox"
							checked={!settings.extrasOff}
							onchange={(event) => settings.setExtrasOff(!event.currentTarget.checked)}
							class="size-4 shrink-0 accent-[var(--color-gold)]"
						/>
					</label>
				</div>
			</section>

			<!-- ============ ผู้เล่าเรื่อง ============ -->
			<section id="gm" class="settings-card scroll-mt-24">
				<h2 class="settings-h2">ผู้เล่าเรื่อง (โมเดล)</h2>
				<div class="mt-4">
					<label class="settings-label block" for="gm-url">GM URL (llama-server)</label>
					<p class="settings-hint">
						ต้องเป็นเครื่องนี้หรือวงแลนเท่านั้น — เว้นว่างเพื่อใช้ค่าเริ่มต้นของเซิร์ฟเวอร์
					</p>
					<Input
						id="gm-url"
						placeholder="http://127.0.0.1:8080/v1"
						class="mt-2"
						value={settings.modelUrl}
						onchange={(event) => settings.setModelUrl(event.currentTarget.value)}
					/>
				</div>
			</section>

			<!-- ============ โน้ตถึงผู้เล่าเรื่อง ============ -->
			<section id="gm-note" class="settings-card scroll-mt-24">
				<h2 class="settings-h2">โน้ตถึงผู้เล่าเรื่อง</h2>
				<p class="settings-hint mt-1">
					คำสั่งพิเศษที่ทับกฎในระบบทั้งหมด (แทรกท้าย prompt ทุกเทิร์น) เช่น "เล่าจากมุมมองบุรุษที่
					2"
				</p>
				<textarea
					class="mt-3 w-full rounded-md border border-input bg-input/30 px-3 py-2.5 text-sm leading-relaxed"
					rows="5"
					maxlength="2000"
					placeholder="เขียนคำสั่งพิเศษสำหรับ GM ที่นี่..."
					value={settings.gmOverride}
					onchange={(event) => settings.setGmOverride(event.currentTarget.value)}></textarea>
			</section>
		</div>
	</div>
</div>

<style>
	.settings-card {
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: color-mix(in oklch, var(--color-card) 65%, transparent);
		padding: 1.15rem 1.25rem 1.35rem;
	}

	.settings-h2 {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-gold);
	}

	.settings-label {
		font-size: 0.8rem;
		font-weight: 700;
	}

	.settings-hint {
		margin-top: 0.1rem;
		font-size: 0.7rem;
		color: var(--color-muted-foreground);
	}

	.nav-link {
		white-space: nowrap;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		padding: 0.45rem 0.8rem;
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
	}

	.font-opt {
		display: block;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: color-mix(in oklch, var(--color-muted) 40%, transparent);
		padding: 0.55rem 0.75rem;
		font-size: 0.8rem;
		text-align: left;
		transition:
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
	}

	.opt-dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-muted-foreground) 60%, transparent);
	}

	.seg-btn {
		flex: 1;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.35rem 0.5rem;
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.nav-link:hover {
			color: var(--color-foreground);
			background: color-mix(in oklch, var(--color-muted) 55%, transparent);
		}
		.font-opt:hover {
			border-color: color-mix(in oklch, var(--color-gold) 35%, transparent);
		}
	}

	.font-opt-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 10%, transparent);
	}

	.opt-dot-on {
		border-color: transparent;
		background: var(--color-gold);
	}

	.seg-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
		font-weight: 600;
	}
</style>
