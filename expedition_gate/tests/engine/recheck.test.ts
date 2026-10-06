// @vitest-environment node
// Recheck regression tests — each one pins a bug found in the 2026-10-06 audit.
process.env.GATE_DB_PATH = ':memory:';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from '$lib/server/db/client';
import { campaigns } from '$lib/server/db/schema';
import { mockRng } from '$lib/server/engine/rules';
import { resolveTurn } from '$lib/server/engine/turn';
import { createCampaign, heroFromProposal, saveGmTurn } from '$lib/server/engine/campaigns';
import { resolveLlamaBaseUrl } from '$lib/server/llama';
import {
	countDeathFails,
	deathConditionsAfter,
	isHeroDead,
	type HeroProposal,
	type WorldBrief,
	type WorldState
} from '$lib/game/worldstate';

const BRIEF: WorldBrief = {
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่',
	situation: 'รอยเท้ายักษ์',
	hooks: ['ตามรอยเท้า'],
	npcs: []
};

const PROPOSAL: HeroProposal = {
	stats: { str: 5, agi: 6, dex: 5, vit: 6, int: 8, spi: 9, cha: 7, luk: 6 },
	weapon: { key: 'sword', label: 'ดาบเหล็ก' },
	armor: { key: 'leather', label: 'เสื้อเกราะหนัง' },
	inventory: [{ name: 'เปื้อน้ำ', qty: 1 }],
	gold: 0,
	background: 'ผู้กล้า'
};

function dyingState(fails = 0): WorldState {
	const id = createCampaign({
		brief: BRIEF,
		hero: heroFromProposal({ name: 'ตะวัน', concept: '', klass: 'นักดาบ' }, PROPOSAL),
		setting: 'custom',
		tone: []
	});
	const db = getDb();
	const [row] = db.select().from(campaigns).where(eq(campaigns.id, id)).all();
	const state = row.stateJson as WorldState;
	const patched: WorldState = {
		...state,
		hero: {
			...state.hero,
			hp: 0,
			conditions: fails > 0 ? [`นับความตาย ${fails}`] : []
		}
	};
	db.update(campaigns).set({ stateJson: patched }).where(eq(campaigns.id, id)).run();
	return patched;
}

describe('death saves (Docs/02 — was missing entirely)', () => {
	it('a dying hero rolls a save even on a free-text turn', () => {
		const result = resolveTurn(
			{ kind: 'free', text: 'พยายามสลัดหนีจากความตาย' },
			dyingState(),
			mockRng([0.05])
		);
		expect(result.rolls?.[0]?.kind).toBe('death-save');
		expect(result.appConditions).toContain('นับความตาย 1');
		expect(result.appMath.hp).toBeUndefined();
	});

	it('d20 ≥ 10 stabilizes at 1 HP and clears the markers', () => {
		const result = resolveTurn(
			{ kind: 'free', text: 'ตั้งสติ' },
			dyingState(2),
			mockRng([0.6]) // die 13
		);
		expect(result.appMath.hp).toBe(1);
		expect(result.appConditions).toEqual([]);
		expect(result.resolutionLine).toContain('ฟื้นคืนที่ 1 HP');
	});

	it('the third failed save seals the hero', () => {
		const result = resolveTurn(
			{ kind: 'flee', text: 'หนี!' },
			dyingState(2),
			mockRng([0.02]) // die 2
		);
		expect(result.appConditions).toContain('นับความตาย 3');
		expect(result.resolutionLine).toContain('สิ้นใจ');
	});

	it('countDeathFails / deathConditionsAfter / isHeroDead helpers agree', () => {
		expect(countDeathFails(['พิษ', 'นับความตาย 2'])).toBe(2);
		expect(deathConditionsAfter(['พิษ', 'นับความตาย 2'], 0)).toEqual(['พิษ']);
		expect(deathConditionsAfter(['พิษ'], 3)).toEqual(['พิษ', 'นับความตาย 3']);
		expect(isHeroDead({ hp: 0, conditions: ['นับความตาย 3'] })).toBe(true);
		expect(isHeroDead({ hp: 0, conditions: ['นับความตาย 1'] })).toBe(false);
		expect(isHeroDead({ hp: 1, conditions: ['นับความตาย 3'] })).toBe(false);
	});

	it('saveGmTurn ends the campaign only at the third fail, not the first drop', () => {
		const db = getDb();

		const id1 = createCampaign({
			brief: BRIEF,
			hero: heroFromProposal({ name: 'ตะวัน', concept: '', klass: 'นักดาบ' }, PROPOSAL),
			setting: 'custom',
			tone: []
		});
		const first = dyingState(1);
		saveGmTurn({ campaignId: id1, content: 'บทที่ยังไม่จบ', state: first, stateStale: false });
		const [row1] = db.select().from(campaigns).where(eq(campaigns.id, id1)).all();
		expect(row1.ended).toBeNull(); // 0 HP but only fail #1 — still fighting

		const id2 = createCampaign({
			brief: BRIEF,
			hero: heroFromProposal({ name: 'ตะวัน', concept: '', klass: 'นักดาบ' }, PROPOSAL),
			setting: 'custom',
			tone: []
		});
		const third = dyingState(3);
		saveGmTurn({ campaignId: id2, content: 'บทสุดท้าย', state: third, stateStale: false });
		const [row2] = db.select().from(campaigns).where(eq(campaigns.id, id2)).all();
		expect(row2.ended).toBe('dead');
	});
});

describe('resolveLlamaBaseUrl (local-only allowlist, fail-closed)', () => {
	it('accepts IPv6 loopback with brackets, private v4, and *.local hosts', () => {
		expect(resolveLlamaBaseUrl('http://[::1]:8080/v1')).toBe('http://[::1]:8080/v1');
		expect(resolveLlamaBaseUrl('http://127.0.0.1:8080/v1/')).toBe('http://127.0.0.1:8080/v1');
		expect(resolveLlamaBaseUrl('http://172.20.4.9:1234')).toBe('http://172.20.4.9:1234');
		expect(resolveLlamaBaseUrl('http://myllama.local:8080/v1')).toContain('myllama.local');
	});

	it('rejects public hosts, wrong schemes, and credentials', () => {
		expect(() => resolveLlamaBaseUrl('https://api.openai.com/v1')).toThrow(/ห้ามคลาวด์/);
		expect(() => resolveLlamaBaseUrl('ftp://127.0.0.1/x')).toThrow(/http\/https/);
		expect(() => resolveLlamaBaseUrl('http://user:pw@127.0.0.1:8080/v1')).toThrow(/ล็อกอิน/);
	});

	it('falls back to the configured endpoint when blank', () => {
		expect(resolveLlamaBaseUrl('')).toBe(resolveLlamaBaseUrl(undefined));
	});
});
