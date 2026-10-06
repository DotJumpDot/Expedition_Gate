import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '$lib/game/scenarios';
import { SETTING_PRESETS, WorldBriefSchema } from '$lib/game/worldstate';
import { HeroProposalSchema } from '$lib/server/engine/worldstate';

describe('ready-to-play scenarios (เริ่มทันที)', () => {
	it('ships at least 5 scenarios with unique ids', () => {
		expect(SCENARIOS.length).toBeGreaterThanOrEqual(5);
		expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
	});

	it('every scenario maps to a real preset (scene art) and passes WorldBriefSchema', () => {
		for (const scenario of SCENARIOS) {
			expect(SETTING_PRESETS[scenario.setting]).toBeDefined();
			const brief = WorldBriefSchema.safeParse(scenario.brief);
			expect(brief.success, `${scenario.id} brief`).toBe(true);
			expect(scenario.brief.hooks.length).toBeGreaterThanOrEqual(3);
			expect(scenario.brief.npcs.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('every ready hero passes HeroProposalSchema with a full 52-point buy', () => {
		for (const scenario of SCENARIOS) {
			expect(scenario.heroes.length).toBeGreaterThanOrEqual(2);
			for (const hero of scenario.heroes) {
				const proposal = HeroProposalSchema.safeParse({
					stats: hero.stats,
					weapon: hero.weapon,
					armor: hero.armor,
					inventory: hero.inventory,
					gold: hero.gold,
					background: hero.background
				});
				expect(proposal.success, `${scenario.id}/${hero.name}`).toBe(true);
				const total = Object.values(hero.stats).reduce((sum, v) => sum + v, 0);
				expect(total, `${scenario.id}/${hero.name} stat buy`).toBe(52);
			}
		}
	});

	it('suggested classes exist in the wizard class list vocabulary', () => {
		// anything custom-shaped must be 'กำหนดเอง'; all others are free text but
		// the scenario chip must not silently drift from the wizard's own labels
		const KNOWN = [
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
		for (const scenario of SCENARIOS) {
			for (const klass of scenario.suggestedClasses) {
				expect(KNOWN, `${scenario.id}: ${klass}`).toContain(klass);
			}
			expect(scenario.suggestedClasses).toContain('กำหนดเอง');
		}
	});
});
