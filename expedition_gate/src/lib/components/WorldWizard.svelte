<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Compass, Minus, Plus, Sparkles, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { STAT_KEYS, STAT_LABELS_TH, type Stats } from '$lib/game/rules';
	import { SETTING_PRESETS, settingPreset, type HeroProposal } from '$lib/game/worldstate';
	import type { WorldBrief } from '$lib/game/worldstate';
	import { SCENARIOS, type Scenario, type ScenarioHero } from '$lib/game/scenarios';
	import HeroPortrait from '$lib/components/game/HeroPortrait.svelte';
	import { settings, type CustomPreset } from '$lib/stores/settings.svelte';

	type Step = 'world' | 'brief' | 'hero' | 'scenario';

	// Query params drive the entry point (?scenario=<id> deep link, ?mode=custom)
	// — read once at mount; the tabs take over from here.
	const params = page.url.searchParams;
	const startScenarioId = params.get('scenario') ?? '';
	const startMode: 'scenario' | 'custom' = params.get('mode') === 'custom' ? 'custom' : 'scenario';
	let step = $state<Step>(startMode === 'scenario' ? 'scenario' : 'world');
	let mode = $state<'scenario' | 'custom'>(startMode);
	/** Hand-authored ready-to-play story (เริ่มทันที). */
	let scenario = $state<Scenario | null>(null);
	let setting = $state('sword_sorcery');
	/** The player-saved preset currently chosen (null = built-in or กำหนดเอง). */
	let customSelected = $state<CustomPreset | null>(null);
	let tones = $state<string[]>([]);
	/** Editable world description — pre-filled from the preset, sent as the premise. */
	let worldDesc = $state(settingPreset('sword_sorcery').description);
	let brief = $state<WorldBrief | null>(null);
	let briefLoading = $state(false);
	let briefError = $state('');
	let heroName = $state('');
	let heroConcept = $state('');
	let heroClass = $state('นักดาบ');
	let customClassName = $state('');
	let customClassNote = $state('');
	let proposal = $state<HeroProposal | null>(null);
	let heroLoading = $state(false);
	let heroError = $state('');
	let stats = $state<Stats | null>(null);
	let creating = $state(false);
	let presetName = $state('');
	let presetSaveMsg = $state('');

	const TONE_OPTIONS = ['มืดมน', 'ผจญภัย', 'ตลกฮา', 'โรแมนติก'];
	const CLASS_OPTIONS = [
		'นักดาบ',
		'อัศวิน',
		'นักเวท',
		'นักเวทดาบ',
		'นักธนู',
		'โจร',
		'นักบวช',
		'หมอผี',
		'นักล่า',
		'นักปราชญ์',
		'นักเล่นแร่แปรธาตุ',
		'กำหนดเอง'
	];
	const SETTING_KEYS = Object.keys(SETTING_PRESETS).filter((key) => key !== 'custom');
	const CUSTOM_CLASS = 'กำหนดเอง';

	const statTotal = $derived(
		stats ? Object.values(stats).reduce((sum, value) => sum + value, 0) : 0
	);
	const pointsLeft = $derived(52 - statTotal);

	function selectPreset(key: string) {
		setting = key;
		customSelected = null;
		worldDesc = settingPreset(key).description;
	}

	function selectCustomPreset(preset: CustomPreset) {
		setting = 'custom';
		customSelected = preset;
		worldDesc = preset.description;
	}

	function toggleTone(tone: string) {
		tones = tones.includes(tone) ? tones.filter((value) => value !== tone) : [...tones, tone];
	}

	function savePreset() {
		presetSaveMsg = '';
		const label = presetName.trim() || settingPreset(setting).label;
		const ok = settings.addCustomPreset({ label, description: worldDesc.trim() });
		presetSaveMsg = ok
			? `บันทึกพรีเซ็ต "${label}" แล้ว`
			: customPresetsFull
				? 'พรีเซ็ตของฉันเต็ม (12) — ลบออกก่อนบันทึกใหม่'
				: 'กรอกรายละเอียดโลกก่อนบันทึก';
		if (ok) presetName = '';
	}

	const customPresetsFull = $derived(settings.customPresets.length >= 12);

	async function generateBrief() {
		briefLoading = true;
		briefError = '';
		try {
			// Built-ins carry their description in the server-side prompt; the
			// premise is sent when the player edits it or plays a custom preset.
			const preset = settingPreset(setting);
			const desc = worldDesc.trim().slice(0, 400);
			const edited = desc.length > 0 && desc !== preset.description;
			const res = await fetch('/api/campaigns/brief', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					setting,
					tone: tones,
					premise: edited ? desc : undefined,
					...(settings.modelUrl ? { baseUrl: settings.modelUrl } : {})
				})
			});
			const data = (await res.json()) as { brief?: WorldBrief; error?: string };
			if (!res.ok || !data.brief) throw new Error(data.error ?? 'สร้างโลกไม่สำเร็จ');
			brief = data.brief;
			step = 'brief';
		} catch (err) {
			briefError = err instanceof Error ? err.message : 'สร้างโลกไม่สำเร็จ';
		} finally {
			briefLoading = false;
		}
	}

	async function generateProposal() {
		if (!brief) return;
		heroLoading = true;
		heroError = '';
		try {
			const isCustom = heroClass === CUSTOM_CLASS;
			const klass = isCustom ? customClassName.trim().slice(0, 40) || 'นักผจญภัย' : heroClass;
			const res = await fetch('/api/campaigns/hero-proposal', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					brief,
					name: heroName,
					concept: heroConcept,
					klass,
					classNote: isCustom ? customClassNote.trim().slice(0, 300) || undefined : undefined,
					...(settings.modelUrl ? { baseUrl: settings.modelUrl } : {})
				})
			});
			const data = (await res.json()) as { proposal?: HeroProposal; error?: string };
			if (!res.ok || !data.proposal) throw new Error(data.error ?? 'สร้างฮีโร่ไม่สำเร็จ');
			proposal = data.proposal;
			stats = { ...data.proposal.stats };
			step = 'hero';
		} catch (err) {
			heroError = err instanceof Error ? err.message : 'สร้างฮีโร่ไม่สำเร็จ';
		} finally {
			heroLoading = false;
		}
	}

	function bumpStat(key: keyof Stats, delta: number) {
		if (!stats) return;
		const next = { ...stats, [key]: stats[key] + delta };
		if (next[key] < 1 || next[key] > 10) return;
		if (delta > 0 && pointsLeft <= 0) return;
		stats = next;
	}

	// --- เริ่มทันที (ready-to-play scenarios) ---

	// Deep link (?scenario=<id>) lands directly on that story's detail.
	const linked = SCENARIOS.find((entry) => entry.id === startScenarioId);
	if (linked) selectScenario(linked);

	function selectScenario(entry: Scenario) {
		scenario = entry;
		proposal = null;
		stats = null;
		brief = entry.brief;
		setting = entry.setting;
		tones = [...entry.tones];
		heroClass = entry.suggestedClasses[0] ?? heroClass;
		heroConcept = '';
		step = 'scenario';
	}

	/**
	 * A ready-made hero IS a proposal — authored by hand, no AI call. Slot it
	 * into the shared proposal view so the player can still tweak the 52-point
	 * buy before starting.
	 */
	function selectReadyHero(hero: ScenarioHero) {
		proposal = {
			stats: hero.stats,
			weapon: hero.weapon,
			armor: hero.armor,
			inventory: hero.inventory,
			gold: hero.gold,
			background: hero.background
		};
		stats = { ...hero.stats };
		heroName = hero.name;
		heroConcept = hero.concept;
		heroClass = hero.klass;
		step = 'hero';
	}

	/** Leave the ready-made heroes and build a custom hero inside this scenario. */
	function buildOwnHero() {
		proposal = null;
		stats = null;
		heroName = '';
		heroConcept = '';
		step = 'hero';
	}

	async function startCampaign() {
		if (!brief || !stats || !proposal || pointsLeft !== 0) return;
		creating = true;
		try {
			const res = await fetch('/api/campaigns', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					setting,
					tone: tones,
					brief,
					heroName,
					heroConcept,
					heroClass,
					proposal: { ...proposal, stats }
				})
			});
			const data = (await res.json()) as { id?: string; error?: string };
			if (!res.ok || !data.id) throw new Error(data.error ?? 'สร้างการผจญภัยไม่สำเร็จ');
			await goto(`/campaign/${data.id}`);
		} catch (err) {
			heroError = err instanceof Error ? err.message : 'สร้างการผจญภัยไม่สำเร็จ';
			creating = false;
		}
	}

	function leave() {
		if (briefLoading || heroLoading || creating) return;
		void goto('/');
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !briefLoading && !heroLoading && !creating) leave();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
	<div class="wizard-card msg-enter" role="form" aria-label="สร้างการผจญภัยใหม่">
		<header class="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
			<h2 class="text-base font-bold">
				{#if step === 'scenario'}
					เริ่มทันที — เรื่องพร้อมเล่น
				{:else if step === 'world'}
					สร้างโลกใหม่
				{:else if step === 'brief'}
					โลกของคุณ
				{:else}
					สร้างนักสำรวจ
				{/if}
			</h2>
			<Button variant="ghost" size="sm" onclick={leave} disabled={creating}>
				<X class="size-4" aria-hidden="true" />
				ปิด
			</Button>
		</header>

		<!-- Mode tabs: ready-to-play stories vs. build-your-own world -->
		<div class="flex gap-1.5 border-b border-border/60 px-5 py-2.5">
			<button
				type="button"
				class="mode-tab {mode === 'scenario' ? 'mode-active' : ''}"
				onclick={() => {
					mode = 'scenario';
					step = 'scenario';
				}}
			>
				🎬 เริ่มทันที
			</button>
			<button
				type="button"
				class="mode-tab {mode === 'custom' ? 'mode-active' : ''}"
				onclick={() => {
					mode = 'custom';
					step = 'world';
				}}
			>
				✍️ สร้างโลกเอง
			</button>
		</div>

		<div class="px-5 py-4">
			{#key `${mode}:${step}:${scenario?.id ?? ''}:${proposal ? 'p' : 'e'}`}
				<div class="step-enter">
					{#if mode === 'scenario' && step === 'scenario'}
						<!-- ============ เริ่มทันที ============ -->
						{#if !scenario}
							<section class="space-y-3">
								<p class="text-sm text-muted-foreground">
									เรื่องพร้อมเล่นที่เขียนไว้เต็มรูปแบบ — เลือกแล้วเข้าเกมได้ทันที ไม่ต้องรอสร้างโลก
								</p>
								{#each SCENARIOS as entry (entry.id)}
									<button type="button" class="scenario-card" onclick={() => selectScenario(entry)}>
										<span class="text-xl">{entry.icon}</span>
										<span class="min-w-0 flex-1">
											<span class="block text-sm font-bold text-gold">{entry.title}</span>
											<span class="mt-0.5 block text-xs leading-relaxed text-muted-foreground"
												>{entry.tagline}</span
											>
										</span>
									</button>
								{/each}
							</section>
						{:else}
							<section class="space-y-4">
								<button
									type="button"
									class="text-xs text-muted-foreground transition-colors hover:text-foreground"
									onclick={() => (scenario = null)}
								>
									← กลับไปเลือกเรื่องอื่น
								</button>

								<div>
									<h3 class="text-lg font-bold text-primary">
										{scenario.icon}
										{scenario.brief.name}
									</h3>
									<p class="mt-1 text-sm leading-relaxed text-pretty">{scenario.brief.terrain}</p>
								</div>

								<div class="rounded-lg border border-border/60 bg-card/50 p-3.5">
									<p
										class="mb-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
									>
										สถานการณ์ของคุณ
									</p>
									<p class="text-sm leading-relaxed text-pretty">{scenario.brief.situation}</p>
								</div>

								<div>
									<p
										class="mb-1.5 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
									>
										เส้นเรื่องที่รออยู่
									</p>
									<ul class="space-y-1 text-sm">
										{#each scenario.brief.hooks as hook (hook)}
											<li>· {hook}</li>
										{/each}
									</ul>
								</div>

								<div>
									<p
										class="mb-1.5 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
									>
										ตัวละครสำคัญ
									</p>
									<ul class="space-y-1 text-sm">
										{#each scenario.brief.npcs as npc (npc.name)}
											<li>· <span class="font-medium">{npc.name}</span> — {npc.role}</li>
										{/each}
									</ul>
								</div>

								<hr class="border-border/60" />

								<p class="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
									เลือกฮีโร่พร้อมเล่น
								</p>
								{#each scenario.heroes as hero (hero.name)}
									<button type="button" class="scenario-card" onclick={() => selectReadyHero(hero)}>
										<span class="min-w-0 flex-1">
											<span class="block text-sm font-bold">{hero.name}</span>
											<span class="block text-xs text-gold">{hero.klass}</span>
											<span
												class="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground"
												>{hero.background}</span
											>
										</span>
										<span class="shrink-0 text-[11px] text-muted-foreground"
											>รวม {Object.values(hero.stats).reduce((s, v) => s + v, 0)} แต้ม</span
										>
									</button>
								{/each}

								<div class="rounded-lg border border-dashed border-border/70 p-3.5">
									<p class="text-xs text-muted-foreground">
										หรือจะสร้างฮีโร่ของตัวเองในเรื่องนี้ — AI จะจัดค่าให้เข้ากับเรื่องโดยอัตโนมัติ
									</p>
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each scenario.suggestedConcepts as concept (concept)}
											<button
												type="button"
												class="tone-chip"
												title="คลิกเพื่อใช้คอนเซปต์นี้"
												onclick={() => {
													heroConcept = concept;
													buildOwnHero();
												}}
											>
												{concept}
											</button>
										{/each}
									</div>
									<Button variant="outline" size="sm" class="mt-2.5" onclick={buildOwnHero}>
										สร้างฮีโร่เองในเรื่องนี้
									</Button>
								</div>
							</section>
						{/if}
					{:else if step === 'world'}
						<!-- Step 1: setting + tone -->
						<section class="space-y-5">
							<div>
								<p class="mb-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
									เลือกฉาก (ทุกฉากแก้ได้)
								</p>
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
									{#each SETTING_KEYS as key (key)}
										<button
											type="button"
											class="setting-card {setting === key && !customSelected
												? 'setting-active col-span-2'
												: ''}"
											title={SETTING_PRESETS[key].label}
											onclick={() => selectPreset(key)}
										>
											{SETTING_PRESETS[key].icon}
											{SETTING_PRESETS[key].label}
										</button>
									{/each}
									{#each settings.customPresets as preset (preset.label)}
										<div
											class="relative {customSelected?.label === preset.label ? 'col-span-2' : ''}"
										>
											<button
												type="button"
												class="setting-card w-full pr-6 {customSelected?.label === preset.label
													? 'setting-active'
													: ''}"
												onclick={() => selectCustomPreset(preset)}
											>
												📌 {preset.label}
											</button>
											<button
												type="button"
												class="preset-x"
												title="ลบพรีเซ็ตนี้"
												aria-label="ลบพรีเซ็ต {preset.label}"
												onclick={() => settings.removeCustomPreset(preset.label)}
											>
												<X class="size-3" aria-hidden="true" />
											</button>
										</div>
									{/each}
									<button
										type="button"
										class="setting-card {setting === 'custom' && !customSelected
											? 'setting-active col-span-2'
											: ''}"
										onclick={() => selectPreset('custom')}
									>
										✍️ กำหนดเอง
									</button>
								</div>
							</div>

							<div>
								<p
									class="mb-1.5 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
								>
									รายละเอียดโลก <span class="tracking-normal text-gold normal-case"
										>(แก้ไขได้ตามใจ)</span
									>
								</p>
								<textarea
									class="w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm leading-relaxed"
									rows="3"
									maxlength="400"
									placeholder="อธิบายโลกที่อยากเล่น เช่น จักรวรรดิตะวันออกที่ขุนนางแย่งบัลลังก์ ผู้เล่นคือทายาทตระกูลจมหนี้..."
									bind:value={worldDesc}></textarea>
								<div class="mt-1.5 flex items-center gap-1.5">
									<Input
										bind:value={presetName}
										placeholder="ตั้งชื่อพรีเซ็ตนี้..."
										class="h-8 flex-1 text-xs"
									/>
									<Button variant="outline" size="sm" onclick={savePreset}
										>บันทึกเป็นพรีเซ็ตของฉัน</Button
									>
								</div>
								{#if presetSaveMsg}
									<p class="mt-1 text-[11px] text-muted-foreground">{presetSaveMsg}</p>
								{/if}
							</div>

							<div>
								<p class="mb-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
									โทนเรื่อง (เลือกได้หลายอย่าง)
								</p>
								<div class="flex flex-wrap gap-2">
									{#each TONE_OPTIONS as tone (tone)}
										<button
											type="button"
											class="tone-chip {tones.includes(tone) ? 'tone-active' : ''}"
											onclick={() => toggleTone(tone)}
										>
											{tone}
										</button>
									{/each}
								</div>
							</div>

							{#if briefError}
								<p class="text-sm text-destructive" role="alert">{briefError}</p>
							{/if}

							<Button size="lg" class="w-full" onclick={generateBrief} disabled={briefLoading}>
								<Sparkles data-icon="inline-start" aria-hidden="true" />
								{briefLoading ? 'กำลังสร้างโลก...' : 'สร้างโลก'}
							</Button>
						</section>
					{:else if step === 'brief' && brief}
						<!-- Step 2: brief preview -->
						<section class="space-y-4">
							<h3 class="text-xl font-bold text-primary">{brief.name}</h3>
							<p class="text-[15px] leading-[1.85] text-pretty">{brief.terrain}</p>
							<div class="rounded-lg border border-border/60 bg-card/50 p-3.5">
								<p class="mb-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
									จุดเริ่มเรื่อง
								</p>
								<p class="text-sm leading-relaxed text-pretty">{brief.situation}</p>
							</div>
							<div>
								<p
									class="mb-1.5 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
								>
									ตะขอเรื่อง
								</p>
								<ul class="space-y-1 text-sm">
									{#each brief.hooks as hook (hook)}
										<li>· {hook}</li>
									{/each}
								</ul>
							</div>

							{#if briefError}
								<p class="text-sm text-destructive" role="alert">{briefError}</p>
							{/if}

							<div class="flex gap-2">
								<Button variant="outline" onclick={generateBrief} disabled={briefLoading}>
									🎲 สุ่มใหม่
								</Button>
								<Button class="flex-1" onclick={() => (step = 'hero')}
									>โลกนี้แล้ว — สร้างฮีโร่</Button
								>
							</div>
						</section>
					{:else if step === 'hero' && brief}
						<!-- Step 3: hero creation -->
						<section class="space-y-4">
							{#if scenario}
								<button
									type="button"
									class="text-xs text-muted-foreground transition-colors hover:text-foreground"
									onclick={() => (step = 'scenario')}
								>
									← กลับไปเรื่อง "{scenario.title}"
								</button>
							{/if}
							{#if !proposal}
								<div class="space-y-4">
									<div class="grid gap-3 sm:grid-cols-2">
										<div>
											<label
												class="mb-1 block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
												for="hero-name">ชื่อ</label
											>
											<Input
												id="hero-name"
												bind:value={heroName}
												placeholder="เช่น ตะวัน ธนาคาร"
												class="h-10"
											/>
										</div>
										<div>
											<p
												class="mb-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
											>
												สายอาชีพ
											</p>
											<div class="flex flex-wrap gap-1.5">
												{#each CLASS_OPTIONS as option (option)}
													<button
														type="button"
														class="tone-chip {heroClass === option ? 'tone-active' : ''}"
														onclick={() => (heroClass = option)}
													>
														{option}
													</button>
												{/each}
											</div>
											{#if heroClass === CUSTOM_CLASS}
												<div
													class="mt-2.5 space-y-2 rounded-lg border border-gold/30 bg-gold/5 p-3"
												>
													<label
														class="block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
														for="custom-class-name">ชื่ออาชีพของคุณ</label
													>
													<Input
														id="custom-class-name"
														bind:value={customClassName}
														placeholder="เช่น นักดาบแห่งกาลเวลา · จอมเวทสายเลือดมังกร"
														class="h-9"
													/>
													<label
														class="block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
														for="custom-class-note">อธิบายความสามารถ / สไตล์การเล่น</label
													>
													<textarea
														id="custom-class-note"
														class="w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm leading-relaxed"
														rows="2"
														maxlength="300"
														placeholder="เช่น ใช้ดาบคู่กับเวทย้อนเวลาเล็กน้อย หลบหลีกเก่ง แต่ร่างกายเปราะ"
														bind:value={customClassNote}></textarea>
												</div>
											{/if}
										</div>
									</div>
									<div>
										<label
											class="mb-1 block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
											for="hero-concept">คอนเซปต์ฮีโร่</label
										>
										{#if scenario}
											<div class="mb-1.5 flex flex-wrap gap-1.5">
												{#each scenario.suggestedConcepts as concept (concept)}
													<button
														type="button"
														class="tone-chip {heroConcept === concept ? 'tone-active' : ''}"
														onclick={() => (heroConcept = concept)}
													>
														{concept}
													</button>
												{/each}
											</div>
										{/if}
										<Input
											id="hero-concept"
											bind:value={heroConcept}
											placeholder="เช่น นักเวทผู้ถูกขับไล่ หาทางกลับบ้าน"
											class="h-10"
										/>
									</div>

									{#if heroError}
										<p class="text-sm text-destructive" role="alert">{heroError}</p>
									{/if}

									<Button
										size="lg"
										class="w-full"
										onclick={generateProposal}
										disabled={heroLoading}
									>
										<Sparkles data-icon="inline-start" aria-hidden="true" />
										{heroLoading ? 'AI กำลังจัดค่าให้...' : 'ให้ AI จัดค่าให้'}
									</Button>
								</div>
							{:else}
								<div class="space-y-4">
									<div class="flex items-center gap-3">
										<HeroPortrait
											heroName={heroName || 'ผู้กล้า'}
											klass={heroClass === CUSTOM_CLASS
												? customClassName.trim() || 'นักผจญภัย'
												: heroClass}
											concept={heroConcept}
											readonly
										/>
										<p class="text-[11px] text-muted-foreground">เปลี่ยนรูปได้ในหน้าเกม</p>
									</div>
									<div class="rounded-lg border border-border/60 bg-card/50 p-3.5">
										<p
											class="mb-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
										>
											ปูมหลัง
										</p>
										<p class="text-sm leading-relaxed text-pretty">{proposal.background}</p>
									</div>

									{#if stats}
										<div>
											<div class="mb-2 flex items-baseline justify-between">
												<p
													class="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
												>
													ค่าสถานะ
												</p>
												<p class="text-xs {pointsLeft === 0 ? 'text-xp' : 'text-gold'}">
													แต้มเหลือ {pointsLeft}
												</p>
											</div>
											<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
												{#each STAT_KEYS as key (key)}
													<div class="stat-box">
														<span class="text-[11px] text-muted-foreground"
															>{STAT_LABELS_TH[key]}</span
														>
														<span class="text-sm font-bold tabular-nums"
															>{key.toUpperCase()} {stats[key]}</span
														>
														<span class="flex gap-1">
															<button
																type="button"
																class="step-btn"
																onclick={() => bumpStat(key, -1)}
																aria-label="ลด {STAT_LABELS_TH[key]}"
															>
																<Minus class="size-3" aria-hidden="true" />
															</button>
															<button
																type="button"
																class="step-btn"
																onclick={() => bumpStat(key, 1)}
																aria-label="เพิ่ม {STAT_LABELS_TH[key]}"
															>
																<Plus class="size-3" aria-hidden="true" />
															</button>
														</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<div class="flex flex-wrap gap-2 text-xs">
										<span class="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5"
											>⚔️ {proposal.weapon.label}</span
										>
										<span class="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5"
											>🛡️ {proposal.armor.label}</span
										>
										<span
											class="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-gold"
											>💰 {proposal.gold} ทอง</span
										>
										{#each proposal.inventory as item (item.name)}
											<span class="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5"
												>{item.name} ×{item.qty}</span
											>
										{/each}
									</div>

									{#if heroError}
										<p class="text-sm text-destructive" role="alert">{heroError}</p>
									{/if}

									<div class="flex gap-2">
										<Button variant="outline" onclick={generateProposal} disabled={heroLoading}
											>🎲 จัดใหม่</Button
										>
										<Button
											class="flex-1"
											onclick={startCampaign}
											disabled={creating || pointsLeft !== 0}
										>
											<Compass data-icon="inline-start" aria-hidden="true" />
											{creating
												? 'กำลังเปิดประตู...'
												: pointsLeft === 0
													? 'เริ่มการผจญภัย'
													: 'แจกแต้มให้ครบ 52 แต้ม (เหลืออีก ' + pointsLeft + ')'}
										</Button>
									</div>
								</div>
							{/if}
						</section>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>

<style>
	.wizard-card {
		position: relative;
		width: 100%;
		border-radius: calc(var(--radius-lg) + 4px);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background:
			radial-gradient(
				ellipse 80% 50% at 50% -20%,
				color-mix(in oklch, var(--color-gold) 6%, transparent),
				transparent 65%
			),
			var(--color-popover);
		box-shadow: 0 24px 64px oklch(0 0 0 / 55%);
	}

	.mode-tab {
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		padding: 0.35rem 0.9rem;
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
	}
	.mode-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 10%, transparent);
		color: var(--color-gold);
		font-weight: 600;
	}

	.scenario-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: color-mix(in oklch, var(--color-card) 55%, transparent);
		padding: 0.75rem 0.95rem;
		text-align: left;
		transition:
			border-color 0.15s var(--ease-out),
			background-color 0.15s var(--ease-out),
			transform 0.12s var(--ease-out);
	}
	.scenario-card:active {
		transform: scale(0.98);
	}

	.setting-card {
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: color-mix(in oklch, var(--color-card) 55%, transparent);
		padding: 0.7rem 0.9rem;
		font-size: 0.85rem;
		text-align: left;
		/* one line, always — long labels ellipsize until the chip is selected */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition:
			border-color 0.15s var(--ease-out),
			background-color 0.15s var(--ease-out),
			transform 0.12s var(--ease-out);
	}
	.setting-card:active {
		transform: scale(0.97);
	}
	.setting-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 10%, transparent);
		font-weight: 600;
	}

	/* step/mode/scenario swaps rise in instead of popping */
	.step-enter {
		animation: card-rise 0.26s var(--ease-out) backwards;
	}

	.preset-x {
		position: absolute;
		top: -6px;
		right: -6px;
		z-index: 5;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		background: var(--color-popover);
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out);
	}
	@media (hover: hover) and (pointer: fine) {
		.preset-x:hover {
			color: var(--color-destructive);
			border-color: color-mix(in oklch, var(--color-destructive) 50%, transparent);
		}
	}

	.tone-chip {
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		padding: 0.32rem 0.85rem;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out),
			background-color 0.12s var(--ease-out);
	}
	.tone-active {
		border-color: color-mix(in oklch, var(--color-gold) 55%, transparent);
		background: color-mix(in oklch, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
		font-weight: 600;
	}

	.stat-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		padding: 0.35rem 0.55rem;
	}

	.step-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 9999px;
		border: 1px solid color-mix(in oklch, var(--color-border) 90%, transparent);
		color: var(--color-muted-foreground);
		transition:
			color 0.12s var(--ease-out),
			border-color 0.12s var(--ease-out);
	}
	.step-btn:active {
		transform: scale(0.9);
	}

	.msg-enter {
		animation: card-rise 0.28s var(--ease-out) backwards;
	}

	@keyframes card-rise {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.scenario-card:hover,
		.setting-card:hover,
		.tone-chip:hover {
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
			color: var(--color-foreground);
		}
		.step-btn:hover {
			color: var(--color-foreground);
			border-color: color-mix(in oklch, var(--color-gold) 40%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.msg-enter,
		.step-enter {
			animation: none;
		}
		.scenario-card,
		.setting-card,
		.step-btn,
		.tone-chip {
			transition: none;
		}
	}
</style>
