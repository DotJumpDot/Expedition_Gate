/**
 * Player settings (client-side, localStorage-backed).
 * chipCount: choice chips 0–6 (0 = off, default 3)
 * narrationLength: สั้น/กลาง/ยาว (P3)
 * extrasOff: 📊 status blocks on/off (P3)
 * modelUrl: override GM endpoint — must be local/LAN (server re-validates) (P3)
 * gmOverride: runtime GM-prompt note, last-instruction-wins (P4)
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

function createSettings() {
	let chipCount = $state(3);
	let narrationLength = $state<NarrationLength>('medium');
	let extrasOff = $state(false);
	let modelUrl = $state('');
	let gmOverride = $state('');

	if (typeof localStorage !== 'undefined') {
		try {
			const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<{
				chipCount: number;
				narrationLength: NarrationLength;
				extrasOff: boolean;
				modelUrl: string;
				gmOverride: string;
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
		} catch {
			// corrupted settings — keep defaults
		}
	}

	function clampChips(n: number): number {
		return Math.max(0, Math.min(6, Math.round(n)));
	}

	function persist() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ chipCount, narrationLength, extrasOff, modelUrl, gmOverride })
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
		setChipCount,
		setNarrationLength,
		setExtrasOff,
		setModelUrl,
		setGmOverride
	};
}

export const settings = createSettings();
