/**
 * Player settings (client-side, localStorage-backed).
 * chipCount: choice chips 0–6 (0 = off, default 3)
 * narrationLength: สั้น/กลาง/ยาว (P3)
 * extrasOff: 📊 status blocks on/off (P3)
 * modelUrl: override GM endpoint — must be local/LAN (server re-validates) (P3)
 * gmOverride: runtime GM-prompt note, last-instruction-wins (P4)
 * fontKey / fontScale: reading font family + UI scale % (2026-10-06 readability pass)
 * heroSide: hero rail on the left or right (default right)
 */

const STORAGE_KEY = 'gate.settings';

export type NarrationLength = 'short' | 'medium' | 'long';

export const LENGTH_HINTS: Record<NarrationLength, string> = {
	short: '1-2 ย่อหน้า (สั้น กระชับ)',
	medium: '2-4 ย่อหน้า (ตามจังหวะเหตุการณ์)',
	long: '4-6 ย่อหน้า (ยาว ละเอียด)'
};

/** max_tokens per length — Gemma thinking-starvation headroom included. */
export const LENGTH_TOKENS: Record<NarrationLength, number> = {
	short: 2048,
	medium: 4096,
	long: 6144
};

export type FontKey = 'system' | 'sarabun' | 'plex' | 'mitr' | 'tahoma' | 'angsana';

export interface FontOption {
	key: FontKey;
	labelTh: string;
	/** CSS font-family stack (bundled families resolve via @font-face in app.css). */
	stack: string;
}

/**
 * Reading fonts. Bundled ones (OFL, static/fonts — see static/fonts/FONTS.md)
 * ship with the app so they work fully offline; the last two fall back to
 * whatever Windows has installed.
 */
export const FONT_OPTIONS: FontOption[] = [
	{
		key: 'sarabun',
		labelTh: 'Sarabun (แนะนำ — อ่านสบาย)',
		stack: "'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', sans-serif"
	},
	{
		key: 'plex',
		labelTh: 'IBM Plex Sans Thai (โปร่ง ทันสมัย)',
		stack: "'IBM Plex Sans Thai', 'Noto Sans Thai', 'Leelawadee UI', sans-serif"
	},
	{
		key: 'mitr',
		labelTh: 'Mitr (หัวมน เป็นมิตร)',
		stack: "'Mitr', 'Noto Sans Thai', 'Leelawadee UI', sans-serif"
	},
	{
		key: 'system',
		labelTh: 'ของระบบเดิม (Leelawadee UI)',
		stack: "'Leelawadee UI', 'Noto Sans Thai', 'Sarabun', 'Segoe UI', system-ui, sans-serif"
	},
	{
		key: 'tahoma',
		labelTh: 'Tahoma (คลาสสิก)',
		stack: "'Tahoma', 'Leelawadee UI', sans-serif"
	},
	{
		key: 'angsana',
		labelTh: 'Angsana (แบบหนังสือไทย — เล็ก ควรเพิ่มขนาด)',
		stack: "'Angsana New', 'TH Sarabun New', 'Sarabun', serif"
	}
];

export type HeroSide = 'left' | 'right';

export type ThemeKey =
	'dark' | 'light' | 'monokai-soda' | 'monokai-night' | 'sakura-light' | 'sakura-dark';

export interface ThemeOption {
	key: ThemeKey;
	labelTh: string;
	/** Card preview: [background, primary/accent, mana] hex/oklch strings. */
	preview: [string, string, string];
}

/** Color themes (app.css `[data-theme='…']` blocks). Applied on <html>. */
export const THEME_OPTIONS: ThemeOption[] = [
	{
		key: 'dark',
		labelTh: 'มืดแฟนตาซี (ค่าเริ่มต้น)',
		preview: ['oklch(0.155 0.012 75)', 'oklch(0.8 0.14 85)', 'oklch(0.66 0.1 262)']
	},
	{
		key: 'light',
		labelTh: 'สว่างกระดาษ',
		preview: ['oklch(0.975 0.008 85)', 'oklch(0.52 0.11 75)', 'oklch(0.5 0.12 262)']
	},
	{
		key: 'monokai-soda',
		labelTh: 'Monokai Soda',
		preview: ['#1a1a19', '#e6db74', '#66d9ef']
	},
	{
		key: 'monokai-night',
		labelTh: 'Monokai Night',
		preview: ['#141413', '#ffd866', '#78dce8']
	},
	{
		key: 'sakura-light',
		labelTh: 'ซากุระ สว่าง',
		preview: ['#fdf5f7', '#c05683', '#7a6bc9']
	},
	{
		key: 'sakura-dark',
		labelTh: 'ซากุระ มืด',
		preview: ['#211a20', '#f0a3c4', '#a89df0']
	}
];

/** Player-saved world presets (wizard: "บันทึกเป็นพรีเซ็ตของฉัน"). */
export interface CustomPreset {
	label: string;
	description: string;
}

const CUSTOM_PRESETS_KEY = 'gate.customPresets';
const MAX_CUSTOM_PRESETS = 12;

function loadCustomPresets(): CustomPreset[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) ?? '[]') as unknown;
		if (!Array.isArray(raw)) return [];
		return raw
			.filter(
				(entry): entry is CustomPreset =>
					typeof entry === 'object' &&
					entry !== null &&
					typeof (entry as CustomPreset).label === 'string' &&
					typeof (entry as CustomPreset).description === 'string'
			)
			.slice(0, MAX_CUSTOM_PRESETS)
			.map((entry) => ({
				label: entry.label.slice(0, 40),
				description: entry.description.slice(0, 400)
			}));
	} catch {
		return [];
	}
}

function createSettings() {
	let chipCount = $state(3);
	let narrationLength = $state<NarrationLength>('medium');
	let extrasOff = $state(false);
	let modelUrl = $state('');
	let gmOverride = $state('');
	let fontKey = $state<FontKey>('sarabun');
	let fontScale = $state(100);
	let heroSide = $state<HeroSide>('right');
	let theme = $state<ThemeKey>('dark');
	let customPresets = $state<CustomPreset[]>(loadCustomPresets());

	if (typeof localStorage !== 'undefined') {
		try {
			const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<{
				chipCount: number;
				narrationLength: NarrationLength;
				extrasOff: boolean;
				modelUrl: string;
				gmOverride: string;
				fontKey: FontKey;
				fontScale: number;
				heroSide: HeroSide;
				theme: ThemeKey;
			}>;
			if (typeof raw.chipCount === 'number') chipCount = clampChips(raw.chipCount);
			if (
				raw.narrationLength === 'short' ||
				raw.narrationLength === 'medium' ||
				raw.narrationLength === 'long'
			) {
				narrationLength = raw.narrationLength;
			}
			if (typeof raw.extrasOff === 'boolean') extrasOff = raw.extrasOff;
			if (typeof raw.modelUrl === 'string') modelUrl = raw.modelUrl;
			if (typeof raw.gmOverride === 'string') gmOverride = raw.gmOverride;
			if (raw.fontKey && FONT_OPTIONS.some((option) => option.key === raw.fontKey)) {
				// narrowed by the FONT_OPTIONS membership check above
				fontKey = raw.fontKey as FontKey;
			}
			if (typeof raw.fontScale === 'number') fontScale = clampScale(raw.fontScale);
			if (raw.heroSide === 'left' || raw.heroSide === 'right') heroSide = raw.heroSide;
			if (THEME_OPTIONS.some((option) => option.key === raw.theme)) {
				theme = raw.theme as ThemeKey;
			}
		} catch {
			// corrupted settings — keep defaults
		}
	}

	function clampChips(n: number): number {
		return Math.max(0, Math.min(6, Math.round(n)));
	}

	function clampScale(n: number): number {
		return Math.max(85, Math.min(140, Math.round(n)));
	}

	function persist() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					chipCount,
					narrationLength,
					extrasOff,
					modelUrl,
					gmOverride,
					fontKey,
					fontScale,
					heroSide,
					theme
				})
			);
		}
	}

	function setChipCount(n: number) {
		chipCount = clampChips(n);
		persist();
	}

	function setNarrationLength(value: NarrationLength) {
		narrationLength = value;
		persist();
	}

	function setExtrasOff(value: boolean) {
		extrasOff = value;
		persist();
	}

	function setModelUrl(value: string) {
		modelUrl = value.trim();
		persist();
	}

	function setGmOverride(value: string) {
		gmOverride = value;
		persist();
	}

	function setFontKey(value: FontKey) {
		if (FONT_OPTIONS.some((option) => option.key === value)) {
			fontKey = value;
			persist();
		}
	}

	function setFontScale(value: number) {
		fontScale = clampScale(value);
		persist();
	}

	function setTheme(value: ThemeKey) {
		if (THEME_OPTIONS.some((option) => option.key === value)) {
			theme = value;
			persist();
		}
	}

	function setHeroSide(value: HeroSide) {
		if (value === 'left' || value === 'right') {
			heroSide = value;
			persist();
		}
	}

	function persistCustomPresets() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
		}
	}

	/** Returns false when the list is full or the entry is empty. */
	function addCustomPreset(preset: CustomPreset): boolean {
		const label = preset.label.trim().slice(0, 40);
		const description = preset.description.trim().slice(0, 400);
		if (!label || !description) return false;
		if (customPresets.length >= MAX_CUSTOM_PRESETS) return false;
		customPresets = [...customPresets, { label, description }];
		persistCustomPresets();
		return true;
	}

	function removeCustomPreset(label: string) {
		customPresets = customPresets.filter((preset) => preset.label !== label);
		persistCustomPresets();
	}

	/** CSS font-family stack for the active font choice. */
	function fontStack(): string {
		return FONT_OPTIONS.find((option) => option.key === fontKey)?.stack ?? FONT_OPTIONS[0].stack;
	}

	return {
		get chipCount() {
			return chipCount;
		},
		get narrationLength() {
			return narrationLength;
		},
		get extrasOff() {
			return extrasOff;
		},
		get modelUrl() {
			return modelUrl;
		},
		get gmOverride() {
			return gmOverride;
		},
		get fontKey() {
			return fontKey;
		},
		get fontScale() {
			return fontScale;
		},
		get heroSide() {
			return heroSide;
		},
		get theme() {
			return theme;
		},
		setTheme,
		get customPresets() {
			return customPresets;
		},
		addCustomPreset,
		removeCustomPreset,
		setChipCount,
		setNarrationLength,
		setExtrasOff,
		setModelUrl,
		setGmOverride,
		setFontKey,
		setFontScale,
		setHeroSide,
		fontStack
	};
}

export const settings = createSettings();
