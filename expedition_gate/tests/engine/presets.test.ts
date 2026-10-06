import { beforeEach, describe, expect, it } from 'vitest';
import { SETTING_PRESETS, settingPreset } from '$lib/game/worldstate';
import { settings } from '$lib/stores/settings.svelte';

describe('SETTING_PRESETS (rich world presets)', () => {
	it('keeps the four original keys plus custom — old saves stay loadable', () => {
		for (const key of ['sword_sorcery', 'scifi', 'horror', 'thai_legend', 'custom']) {
			expect(SETTING_PRESETS[key]).toBeDefined();
		}
	});

	it('every preset has a label, a valid art bucket, and an icon', () => {
		const buckets = ['sword_sorcery', 'scifi', 'horror', 'thai_legend', 'any'];
		for (const preset of Object.values(SETTING_PRESETS)) {
			expect(preset.label.trim().length).toBeGreaterThan(0);
			expect(preset.icon.trim().length).toBeGreaterThan(0);
			expect(buckets).toContain(preset.art);
		}
	});

	it('every built-in preset steers the GM with a description (except กำหนดเอง)', () => {
		for (const preset of Object.values(SETTING_PRESETS)) {
			if (preset.key === 'custom') {
				expect(preset.description).toBe('');
			} else {
				expect(preset.description.length).toBeGreaterThan(40);
				expect(preset.description.length).toBeLessThanOrEqual(400);
			}
		}
	});

	it('settingPreset falls back to custom for unknown keys (old/imported saves)', () => {
		expect(settingPreset('magic_academy').label).toBe('สถาบันเวทมนตร์');
		expect(settingPreset('does_not_exist').key).toBe('custom');
	});
});

describe('custom presets store (player-saved presets)', () => {
	beforeEach(() => {
		// the store is a module singleton — drain it, not just localStorage
		for (const preset of [...settings.customPresets]) {
			settings.removeCustomPreset(preset.label);
		}
		localStorage.clear();
	});

	it('adds, persists, and removes presets', () => {
		expect(settings.addCustomPreset({ label: 'แดนมังกร', description: 'โลกที่มังกรครองฟ้า' })).toBe(
			true
		);
		expect(settings.customPresets).toHaveLength(1);
		// persisted
		const raw = JSON.parse(localStorage.getItem('gate.customPresets') ?? '[]') as unknown[];
		expect(raw).toHaveLength(1);
		settings.removeCustomPreset('แดนมังกร');
		expect(settings.customPresets).toHaveLength(0);
	});

	it('rejects empty labels/descriptions and enforces the 12-preset cap', () => {
		expect(settings.addCustomPreset({ label: '  ', description: 'x' })).toBe(false);
		expect(settings.addCustomPreset({ label: 'x', description: '   ' })).toBe(false);
		for (let i = 0; i < 12; i++) {
			expect(settings.addCustomPreset({ label: `p${i}`, description: 'd' })).toBe(true);
		}
		expect(settings.addCustomPreset({ label: 'p13', description: 'd' })).toBe(false);
	});

	it('trims and clamps long input', () => {
		expect(settings.addCustomPreset({ label: '  ชื่อยาว  ', description: `x`.repeat(900) })).toBe(
			true
		);
		const saved = settings.customPresets.at(-1);
		expect(saved?.label).toBe('ชื่อยาว');
		expect(saved?.description.length).toBeLessThanOrEqual(400);
	});
});
