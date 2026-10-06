/**
 * Player settings (client-side, localStorage-backed). P2 scope: choice-chip
 * count 0–6 (0 = off, default 3). More settings land in P3.
 */

const STORAGE_KEY = 'gate.settings';

function createSettings() {
	let chipCount = $state(3);

	if (typeof localStorage !== 'undefined') {
		try {
			const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
				chipCount?: number;
			};
			if (typeof raw.chipCount === 'number') chipCount = clampChips(raw.chipCount);
		} catch {
			// corrupted settings — keep defaults
		}
	}

	function clampChips(n: number): number {
		return Math.max(0, Math.min(6, Math.round(n)));
	}

	function setChipCount(n: number) {
		chipCount = clampChips(n);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ chipCount }));
		}
	}

	return {
		get chipCount() {
			return chipCount;
		},
		setChipCount
	};
}

export const settings = createSettings();
