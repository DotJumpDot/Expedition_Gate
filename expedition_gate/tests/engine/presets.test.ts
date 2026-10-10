import { beforeEach, describe, expect, it } from 'vitest';
import {
	PRESET_GROUPS,
	presetMatches,
	SETTING_PRESETS,
	settingPreset,
	textMatchesQuery
} from '$lib/game/worldstate';
import { settings } from '$lib/stores/settings.svelte';

describe('SETTING_PRESETS (rich world presets)', () => {
	it('keeps the four original keys plus custom — old saves stay loadable', () => {
		for (const key of ['sword_sorcery', 'scifi', 'horror', 'thai_legend', 'custom']) {
			expect(SETTING_PRESETS[key]).toBeDefined();
		}
	});

	it('ships 28 built-ins (15 originals + the 13-preset manhwa wave)', () => {
		const builtIns = Object.keys(SETTING_PRESETS).filter((key) => key !== 'custom');
		expect(builtIns).toHaveLength(28);
	});

	it('every preset has a label, a valid art bucket, and an icon', () => {
		const buckets = ['sword_sorcery', 'scifi', 'horror', 'thai_legend', 'any'];
		for (const preset of Object.values(SETTING_PRESETS)) {
			expect(preset.label.trim().length).toBeGreaterThan(0);
			expect(preset.icon.trim().length).toBeGreaterThan(0);
			expect(buckets).toContain(preset.art);
		}
	});

	it('record keys match their preset.key fields, labels and icons stay unique', () => {
		const labels = new Set<string>();
		const icons = new Set<string>();
		for (const [key, preset] of Object.entries(SETTING_PRESETS)) {
			expect(preset.key).toBe(key);
			expect(labels.has(preset.label)).toBe(false);
			expect(icons.has(preset.icon)).toBe(false);
			labels.add(preset.label);
			icons.add(preset.icon);
		}
	});

	it('every built-in preset steers the GM with a description (except กำหนดเอง)', () => {
		for (const preset of Object.values(SETTING_PRESETS)) {
			if (preset.key === 'custom') {
				expect(preset.description).toBe('');
			} else {
				expect(preset.description.length).toBeGreaterThan(40);
				// the brief endpoint truncates premises at 400 — presets must fit intact
				expect(preset.description.length).toBeLessThanOrEqual(400);
			}
		}
	});

	it('PRESET_GROUPS show every built-in exactly once (wizard completeness)', () => {
		const grouped = PRESET_GROUPS.flatMap((group) => group.keys);
		const builtIns = Object.keys(SETTING_PRESETS).filter((key) => key !== 'custom');
		expect(new Set(grouped).size).toBe(grouped.length); // no duplicates across groups
		expect([...grouped].sort()).toEqual([...builtIns].sort());
		for (const group of PRESET_GROUPS) {
			expect(group.label.trim().length).toBeGreaterThan(0);
		}
	});

	it('manhwa wave is present: gates, regression, tower, murim, villainess…', () => {
		for (const key of [
			'hunter_gate',
			'regressor',
			'tower_climb',
			'murim',
			'villainess',
			'extra_novel',
			'monster_reborn',
			'dungeon_lord',
			'necromancer',
			'gladiator_arena',
			'myth_demigod',
			'zombie_break',
			'shaman_seoul'
		]) {
			expect(SETTING_PRESETS[key]).toBeDefined();
			expect(SETTING_PRESETS[key].description.length).toBeGreaterThan(40);
		}
	});

	it('settingPreset falls back to custom for unknown keys (old/imported saves)', () => {
		expect(settingPreset('magic_academy').label).toBe('สถาบันเวทมนตร์');
		expect(settingPreset('does_not_exist').key).toBe('custom');
	});
});

describe('preset search (presetMatches / textMatchesQuery)', () => {
	it('empty query matches everything', () => {
		for (const preset of Object.values(SETTING_PRESETS)) {
			expect(presetMatches(preset, '   ')).toBe(true);
		}
	});

	it('matches Thai substrings in label and description', () => {
		expect(presetMatches(SETTING_PRESETS.murim, 'มูริม')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.hunter_gate, 'ดันเจี้ยน')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.thai_legend, 'มูริม')).toBe(false);
	});

	it('matches Thai and English genre keywords, case-insensitively', () => {
		expect(presetMatches(SETTING_PRESETS.hunter_gate, 'Solo Leveling')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.zombie_break, 'ZOMBIE')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.villainess, 'otome')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.villainess, 'นางร้าย')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.villainess, 'วายร้าย')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.villainess, 'ตัวร้าย')).toBe(true);
	});

	it('searching มังฮวา surfaces the whole manhwa group', () => {
		const group = PRESET_GROUPS.find((entry) => entry.keys.includes('hunter_gate'));
		expect(group).toBeDefined();
		for (const key of group!.keys) {
			expect(presetMatches(SETTING_PRESETS[key], 'มังฮวา')).toBe(true);
		}
		expect(presetMatches(SETTING_PRESETS.sword_sorcery, 'มังฮวา')).toBe(false);
	});

	it('multi-token queries are AND — every token must appear', () => {
		expect(presetMatches(SETTING_PRESETS.hunter_gate, 'ฮันเตอร์ ดันเจี้ยน')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.hunter_gate, 'hunter guild')).toBe(true);
		expect(presetMatches(SETTING_PRESETS.hunter_gate, 'hunter โจรสลัด')).toBe(false);
	});

	it('every keywords field is normalized lowercase (Thai or ASCII) words', () => {
		for (const preset of Object.values(SETTING_PRESETS)) {
			if (!preset.keywords) continue;
			expect(preset.keywords).toMatch(/^[a-z0-9ก-๙ ]+$/);
			expect(preset.keywords).toBe(preset.keywords.trim());
		}
	});

	it('textMatchesQuery works standalone (player-saved presets)', () => {
		expect(textMatchesQuery('แดนมังกร โลกที่มังกรครองฟ้า', 'มังกร')).toBe(true);
		expect(textMatchesQuery('แดนมังกร', 'solo')).toBe(false);
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
