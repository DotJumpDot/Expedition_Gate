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

function createSettings() {
	let chipCount = $state(3);
	let narrationLength = $state<NarrationLength>('medium');
	let extrasOff = $state(false);
	let modelUrl = $state('');
	let gmOverride = $state('');
	let fontKey = $state<FontKey>('sarabun');
	let fontScale = $state(100);
	let heroSide = $state<HeroSide>('right');

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
					heroSide
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

	function setHeroSide(value: HeroSide) {
		if (value === 'left' || value === 'right') {
			heroSide = value;
			persist();
		}
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
