// @vitest-environment node
// DB-level engine tests. GATE_DB_PATH must be set before the first getDb()
// call (it is lazy), so the engine singleton becomes an isolated :memory: db.
process.env.GATE_DB_PATH = ':memory:';

import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from '$lib/server/db/client';
import { campaigns, messages } from '$lib/server/db/schema';
import {
	appendMessage,
	createCampaign,
	createCheckpoint,
	heroFromProposal,
	levelUpCampaign,
	listCheckpoints,
	maybeConsolidate,
	rebirthCampaign,
	restoreCheckpoint,
	saveGmTurn
} from '$lib/server/engine/campaigns';
import type { HeroProposal } from '$lib/server/engine/gm';
import {
	WorldBriefSchema,
	WorldStateSchema,
	type WorldBrief,
	type WorldState
} from '$lib/server/engine/worldstate';

const BRIEF: WorldBrief = WorldBriefSchema.parse({
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่',
	situation: 'รอยเท้ายักษ์ปรากฏทุกเช้ามืด',
	hooks: ['ตามรอยเท้า'],
	npcs: [{ name: 'ลุงหมึก', role: 'พ่อค้า' }]
});

const PROPOSAL: HeroProposal = {
	stats: { str: 5, agi: 6, dex: 5, vit: 6, int: 8, spi: 9, cha: 7, luk: 6 },
	weapon: { key: 'sword', label: 'ดาบเหล็ก' },
	armor: { key: 'leather', label: 'เสื้อเกราะหนัง' },
	inventory: [{ name: 'เปื้อน้ำ', qty: 2 }],
	gold: 100,
	background: 'ลูกหลานหมอผีผู้ถูกขับไล่'
};

function newCampaign(): string {
	return createCampaign({
		brief: BRIEF,
		hero: heroFromProposal({ name: 'ตะวัน', concept: '', klass: 'นักเวท' }, PROPOSAL),
		setting: 'thai_legend',
		tone: ['มืดมน']
	});
}

function getState(id: string): WorldState {
	const db = getDb();
	const [row] = db.select().from(campaigns).where(eq(campaigns.id, id)).all();
	return WorldStateSchema.parse(row.stateJson);
}

function putState(id: string, patch: (state: WorldState) => WorldState) {
	const db = getDb();
	db.update(campaigns)
		.set({ stateJson: patch(getState(id)) })
		.where(eq(campaigns.id, id))
		.run();
}

describe('checkpoints (auto-snapshot-first, nothing is ever lost)', () => {
	it('saves, restores, auto-snapshots the abandoned branch, and trims messages', () => {
		const id = newCampaign();
		appendMessage({ campaignId: id, role: 'player', content: 'เริ่มเดินทาง' });
		appendMessage({ campaignId: id, role: 'gm', content: 'คุณมาถึงชายป่า' });
		expect(createCheckpoint(id, 'ก่อนเข้าป่า')).toBe(true);

		// Play past the checkpoint, then restore.
		appendMessage({ campaignId: id, role: 'player', content: 'เดินลึกเข้าป่า' });
		appendMessage({ campaignId: id, role: 'gm', content: 'คุณพบรอยเท้ายักษ์' });
		const [cp] = listCheckpoints(id);
		const restored = restoreCheckpoint(id, cp.id);
		expect(restored.ok).toBe(true);

		const remaining = getDb().select().from(messages).where(eq(messages.campaignId, id)).all();
		expect(remaining).toHaveLength(2); // trimmed back to the checkpoint ceiling

		const cps = listCheckpoints(id);
		expect(cps).toHaveLength(2); // original + auto-snapshot of the abandoned branch
		expect(cps.some((c) => c.auto)).toBe(true);
		expect(cps.find((c) => c.auto)?.note).toContain('สาขาก่อนย้อนเวลา');

		// The auto-snapshot still holds the trimmed branch — restorable back.
		const autoCp = cps.find((c) => c.auto)!;
		const roundTrip = restoreCheckpoint(id, autoCp.id);
		expect(roundTrip.ok).toBe(true);
		expect(getDb().select().from(messages).where(eq(messages.campaignId, id)).all()).toHaveLength(
			4
		);
	});
});

describe('turn counter + consolidation trigger', () => {
	it('saveGmTurn increments turnCount; maybeConsolidate survives llama being down', async () => {
		const id = newCampaign();
		saveGmTurn({ campaignId: id, content: 'บทที่ 1', state: getState(id), stateStale: false });
		saveGmTurn({ campaignId: id, content: 'บทที่ 2', state: getState(id), stateStale: false });
		const db = getDb();
		const [row] = db
			.select({ turnCount: campaigns.turnCount })
			.from(campaigns)
			.where(eq(campaigns.id, id))
			.all();
		expect(row.turnCount).toBe(2);

		// No llama on the default URL — consolidation must degrade silently.
		await expect(maybeConsolidate(id)).resolves.toBeUndefined();
	});
});

describe('level-up (app math only)', () => {
	it('levels up with exactly 2 points, deducts XP, raises pools', () => {
		const id = newCampaign();
		putState(id, (state) => ({ ...state, hero: { ...state.hero, xp: 150 } }));

		const result = levelUpCampaign(id, { str: 1, int: 1 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			const hero = result.state.hero;
			expect(hero.level).toBe(2);
			expect(hero.xp).toBe(50); // 150 − 100
			expect(hero.stats.str).toBe(6);
			expect(hero.stats.int).toBe(9);
			// Pools use the POST-allocation stats: +HP(VIT×2) +MP(INT×2)
			expect(hero.maxHp).toBe(20 + 6 * 4 + 6 * 2);
			expect(hero.maxMp).toBe(8 + (8 + 9) * 2 + 9 * 2);
		}
	});

	it('rejects wrong point counts, stat overflow, and missing XP', () => {
		const id = newCampaign();
		putState(id, (state) => ({ ...state, hero: { ...state.hero, xp: 150 } }));
		expect(levelUpCampaign(id, { str: 1 }).ok).toBe(false); // 1 point
		expect(levelUpCampaign(id, { str: 3 }).ok).toBe(false); // 3 points
		putState(id, (state) => ({
			...state,
			hero: { ...state.hero, stats: { ...state.hero.stats, str: 10 }, xp: 150 }
		}));
		expect(levelUpCampaign(id, { str: 2 }).ok).toBe(false); // over cap

		const id2 = newCampaign();
		expect(levelUpCampaign(id2, { str: 1, agi: 1 }).ok).toBe(false); // no XP
	});
});

describe('rebirth — ประตูบานใหม่ (same world, new hero)', () => {
	it('carries the world + chronicle forward and resets the hero', () => {
		const id = newCampaign();
		const db = getDb();
		putState(id, (state) => ({ ...state, hero: { ...state.hero, hp: 0 } }));
		db.update(campaigns)
			.set({ ended: 'dead', chronicle: '**เหตุการณ์ใหญ่:** ฮีโร่คนแรกเสียชีวิต' })
			.where(eq(campaigns.id, id))
			.run();

		const newId = rebirthCampaign({
			campaignId: id,
			heroName: 'ค่ำ',
			heroConcept: 'นักล่าจิ้งจก',
			heroClass: 'นักล่า',
			proposal: PROPOSAL
		});
		expect(newId).toBeTruthy();
		expect(newId).not.toBe(id);

		const fresh = getState(newId!);
		expect(fresh.hero.name).toBe('ค่ำ');
		expect(fresh.hero.hp).toBe(fresh.hero.maxHp); // fresh pools
		expect(fresh.npcs[0]?.name).toBe('ลุงหมึก'); // world cast persists
		expect(fresh.quests).toHaveLength(1); // quests persist
		expect(fresh.recentEvents.at(-1)).toContain('ประตูบานใหม่');

		const [newRow] = db
			.select({ chronicle: campaigns.chronicle, ended: campaigns.ended })
			.from(campaigns)
			.where(eq(campaigns.id, newId!))
			.all();
		expect(newRow.chronicle).toContain('ฮีโร่คนแรกเสียชีวิต');
		expect(newRow.chronicle).toContain('ประตูบานใหม่');
		expect(newRow.ended).toBeNull(); // new run is open
	});
});

describe('gm message count sanity for the memory window', () => {
	it('appendMessage keeps strict seq order under mixed roles', () => {
		const id = newCampaign();
		appendMessage({ campaignId: id, role: 'player', content: 'ก1' });
		appendMessage({ campaignId: id, role: 'gm', content: 'น1' });
		appendMessage({ campaignId: id, role: 'player', content: 'ก2' });
		const rows = getDb()
			.select({ seq: messages.seq })
			.from(messages)
			.where(and(eq(messages.campaignId, id)))
			.all();
		expect(rows.map((row) => row.seq)).toEqual([1, 2, 3]);
	});
});
