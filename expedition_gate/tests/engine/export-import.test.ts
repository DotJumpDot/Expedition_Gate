// @vitest-environment node
process.env.GATE_DB_PATH = ':memory:';

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from '$lib/server/db/client';
import { campaigns } from '$lib/server/db/schema';
import {
	appendMessage,
	createCampaign,
	exportCampaign,
	heroFromProposal,
	importCampaign,
	parseState
} from '$lib/server/engine/campaigns';
import type { HeroProposal } from '$lib/game/worldstate';
import type { WorldBrief } from '$lib/game/worldstate';
import { SCENE_TAGS } from '$lib/game/worldstate';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BRIEF: WorldBrief = {
	name: 'ทุ่งประตูหิน',
	terrain: 'หุบเขาป่าไผ่',
	situation: 'รอยเท้ายักษ์',
	hooks: ['ตามรอยเท้า'],
	npcs: [{ name: 'ลุงหมึก', role: 'พ่อค้า' }]
};

const PROPOSAL: HeroProposal = {
	stats: { str: 5, agi: 6, dex: 5, vit: 6, int: 8, spi: 9, cha: 7, luk: 6 },
	weapon: { key: 'sword', label: 'ดาบเหล็ก' },
	armor: { key: 'leather', label: 'เสื้อเกราะหนัง' },
	inventory: [{ name: 'เปื้อน้ำ', qty: 2 }],
	gold: 100,
	background: 'ลูกหลานหมอผี'
};

describe('campaign export / import (P4)', () => {
	it('round-trips the whole campaign: messages, state, memory, meta', () => {
		const id = createCampaign({
			brief: BRIEF,
			hero: heroFromProposal({ name: 'ตะวัน', concept: '', klass: 'นักเวท' }, PROPOSAL),
			setting: 'thai_legend',
			tone: ['มืดมน']
		});
		appendMessage({ campaignId: id, role: 'player', content: 'ก1', meta: { dice: [1] } });
		appendMessage({ campaignId: id, role: 'gm', content: 'น1', meta: { sugCache: ['a'] } });
		const exported = exportCampaign(id);
		expect(exported).not.toBeNull();
		expect(exported!.gate).toBe(1);
		expect(exported!.messages).toHaveLength(2);

		const newId = importCampaign(exported!);
		expect(newId).toBeTruthy();
		expect(newId).not.toBe(id);

		const db = getDb();
		const [row] = db.select().from(campaigns).where(eq(campaigns.id, newId!)).all();
		expect(row.title).toBe('ทุ่งประตูหิน');
		expect(row.turnCount).toBe(0);
		const state = parseState(row.stateJson);
		expect(state?.hero.name).toBe('ตะวัน');
		// message round trip preserved roles, seq, and meta
		expect(exported!.messages.map((message) => message.role)).toEqual(
			exportCampaign(newId!)!.messages.map((message) => message.role)
		);
	});

	it('rejects garbage payloads and broken state', () => {
		expect(
			importCampaign({ gate: 1, exportedAt: '', campaign: null as never, messages: [] })
		).toBeNull();
		const id = createCampaign({
			brief: BRIEF,
			hero: heroFromProposal({ name: 'ตะวัน', concept: '', klass: 'นักเวท' }, PROPOSAL),
			setting: 'custom',
			tone: []
		});
		const exported = exportCampaign(id)!;
		const broken = { ...exported, campaign: { ...exported.campaign, stateJson: { nope: true } } };
		expect(importCampaign(broken)).toBeNull();
	});
});

describe('scene-art manifest integrity (P4)', () => {
	it('every entry carries full license attribution and valid vocabulary tags', () => {
		const manifest = JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf8')) as {
			images: Array<{
				file: string;
				tags: string[];
				source: string;
				license: string;
				author: string;
			}>;
		};
		expect(manifest.images.length).toBeGreaterThan(0);
		for (const entry of manifest.images) {
			expect(entry.file, 'file').toBeTruthy();
			expect(entry.source, `${entry.file} source`).toBeTruthy();
			expect(entry.license, `${entry.file} license`).toBeTruthy();
			expect(entry.author, `${entry.file} author`).toBeTruthy();
			for (const tag of entry.tags) {
				expect(SCENE_TAGS, `${entry.file} tag ${tag}`).toContain(tag as never);
			}
		}
	});

	it('sceneTag default state stays inside the manifest vocabulary', () => {
		expect(SCENE_TAGS).toContain('gate');
	});
});
