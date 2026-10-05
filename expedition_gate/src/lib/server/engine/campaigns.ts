/**
 * Campaign persistence — all SQL via Drizzle parameterized calls.
 * stateJson/worldBrief are JSON strings validated at the engine boundary.
 */
import { desc, eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { campaigns, messages, type MessageRole } from '../db/schema';
import { maxHp, maxMp, type Stats } from './rules';
import {
	initialWorldState,
	WorldBriefSchema,
	WorldStateSchema,
	type Hero,
	type WorldBrief,
	type WorldState
} from './worldstate';
import type { HeroProposal } from './gm';

export interface CampaignRow {
	id: string;
	title: string;
	setting: string;
	tone: string;
	worldBrief: string;
	stateJson: unknown;
	stateStale: boolean;
	ended: string | null;
	createdAt: Date;
	updatedAt: Date;
	lastPlayedAt: Date | null;
}

export function parseBrief(raw: string): WorldBrief | null {
	try {
		const parsed = WorldBriefSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function parseState(raw: unknown): WorldState | null {
	const parsed = WorldStateSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}

/** Build the full Hero record from an accepted AI proposal (+ player identity). */
export function heroFromProposal(
	identity: { name: string; concept: string; klass: string },
	proposal: HeroProposal
): Hero {
	const stats: Stats = proposal.stats;
	return {
		name: identity.name || 'นักสำรวจไร้นาม',
		concept: identity.concept,
		klass: identity.klass,
		level: 1,
		xp: 0,
		stats,
		hp: maxHp(stats.vit),
		maxHp: maxHp(stats.vit),
		mp: maxMp(stats.int, stats.spi),
		maxMp: maxMp(stats.int, stats.spi),
		conditions: [],
		equipment: { weapon: proposal.weapon, armor: proposal.armor },
		inventory: proposal.inventory,
		gold: proposal.gold,
		luckPoints: stats.luk
	};
}

export function createCampaign(input: {
	brief: WorldBrief;
	hero: Hero;
	setting: string;
	tone: string[];
}): string {
	const db = getDb();
	const id = crypto.randomUUID();
	const state = initialWorldState(input.brief, input.hero);
	db.insert(campaigns)
		.values({
			id,
			title: input.brief.name,
			setting: input.setting,
			tone: JSON.stringify(input.tone),
			worldBrief: JSON.stringify(input.brief),
			stateJson: state,
			lastPlayedAt: new Date()
		})
		.run();
	return id;
}

export function listCampaigns(): Array<{
	id: string;
	title: string;
	setting: string;
	ended: string | null;
	updatedAt: Date;
	lastPlayedAt: Date | null;
	heroName: string | null;
	day: number | null;
}> {
	const db = getDb();
	const rows = db
		.select()
		.from(campaigns)
		.where(isNull(campaigns.ended))
		.orderBy(desc(sql`coalesce(${campaigns.lastPlayedAt}, ${campaigns.updatedAt})`))
		.all();
	return rows.map((row) => {
		const state = parseState(row.stateJson);
		return {
			id: row.id,
			title: row.title,
			setting: row.setting,
			ended: row.ended,
			updatedAt: row.updatedAt,
			lastPlayedAt: row.lastPlayedAt,
			heroName: state?.hero.name ?? null,
			day: state?.world.day ?? null
		};
	});
}

export function getCampaign(id: string) {
	const db = getDb();
	const [row] = db.select().from(campaigns).where(eq(campaigns.id, id)).all();
	return row ?? null;
}

export function getMessages(campaignId: string, limit = 200) {
	const db = getDb();
	return db
		.select()
		.from(messages)
		.where(eq(messages.campaignId, campaignId))
		.orderBy(messages.seq)
		.limit(limit)
		.all();
}

export function appendMessage(input: {
	campaignId: string;
	role: MessageRole;
	content: string;
	meta?: Record<string, unknown>;
}): number {
	const db = getDb();
	const [{ maxSeq }] = db
		.select({ maxSeq: sql<number>`coalesce(max(${messages.seq}), 0)` })
		.from(messages)
		.where(eq(messages.campaignId, input.campaignId))
		.all();
	const seq = maxSeq + 1;
	db.insert(messages)
		.values({
			id: crypto.randomUUID(),
			campaignId: input.campaignId,
			seq,
			role: input.role,
			content: input.content,
			meta: input.meta ?? null
		})
		.run();
	return seq;
}

/** Persist a completed GM turn: message + state atomically-enough for single-user play. */
export function saveGmTurn(input: {
	campaignId: string;
	content: string;
	state: WorldState;
	stateStale: boolean;
}) {
	const db = getDb();
	appendMessage({ campaignId: input.campaignId, role: 'gm', content: input.content });
	db.update(campaigns)
		.set({
			stateJson: input.state,
			stateStale: input.stateStale,
			updatedAt: new Date(),
			lastPlayedAt: new Date(),
			...(input.state.hero.hp === 0 ? { ended: 'dead' } : {})
		})
		.where(eq(campaigns.id, input.campaignId))
		.run();
}

export function deleteCampaign(id: string) {
	const db = getDb();
	db.delete(campaigns).where(eq(campaigns.id, id)).run();
}

/** Latest rows for the memory window (oldest → newest). */
export function historyWindow(campaignId: string, count = 14) {
	const db = getDb();
	const rows = db
		.select({ role: messages.role, content: messages.content })
		.from(messages)
		.where(and(eq(messages.campaignId, campaignId)))
		.orderBy(desc(messages.seq))
		.limit(count)
		.all();
	return rows.reverse();
}
