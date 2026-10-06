/**
 * Campaign persistence — all SQL via Drizzle parameterized calls.
 * stateJson/worldBrief are JSON strings validated at the engine boundary.
 */
import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { campaigns, checkpoints, messages, type MessageRole } from '../db/schema';
import { applyLevelUp, maxHp, maxMp, STAT_KEYS, STAT_MAX, xpToNext, type Stats } from './rules';
import { consolidateChronicle, consolidateSessionSummary, type HeroProposal } from './gm';
import {
	initialWorldState,
	WorldBriefSchema,
	WorldStateSchema,
	type Hero,
	type WorldBrief,
	type WorldState
} from './worldstate';

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

/** Persist a completed GM turn: message + state + turn counter. Returns the new turn count. */
export function saveGmTurn(input: {
	campaignId: string;
	content: string;
	state: WorldState;
	stateStale: boolean;
	extraMeta?: Record<string, unknown>;
}): number {
	const db = getDb();
	appendMessage({
		campaignId: input.campaignId,
		role: 'gm',
		content: input.content,
		meta: input.extraMeta
	});
	const [row] = db
		.select({ turnCount: campaigns.turnCount })
		.from(campaigns)
		.where(eq(campaigns.id, input.campaignId))
		.all();
	const turnCount = (row?.turnCount ?? 0) + 1;
	db.update(campaigns)
		.set({
			stateJson: input.state,
			stateStale: input.stateStale,
			turnCount,
			updatedAt: new Date(),
			lastPlayedAt: new Date(),
			...(input.state.hero.hp === 0 ? { ended: 'dead' } : {})
		})
		.where(eq(campaigns.id, input.campaignId))
		.run();
	return turnCount;
}

// ---------------------------------------------------------------------------
// Memory consolidation (session summary every 8 turns, chronicle every 20)
// ---------------------------------------------------------------------------

const SUMMARY_EVERY = 8;
const CHRONICLE_EVERY = 20;

/** Fire after a turn completes; failures keep the old memory (never fatal). */
export async function maybeConsolidate(campaignId: string): Promise<void> {
	const row = getCampaign(campaignId);
	if (!row) return;
	const { turnCount, sessionSummary, chronicle } = row;

	const rebuildSummary = turnCount > 0 && turnCount % SUMMARY_EVERY === 0;
	const rebuildChronicle = turnCount > 0 && turnCount % CHRONICLE_EVERY === 0;
	if (!rebuildSummary && !rebuildChronicle) return;

	const events = recentExchangesText(campaignId, 16);
	if (!events) return;

	const db = getDb();
	if (rebuildChronicle) {
		const result = await consolidateChronicle({ existing: chronicle, events });
		if (result.ok) {
			db.update(campaigns)
				.set({ chronicle: result.text })
				.where(eq(campaigns.id, campaignId))
				.run();
		}
	}
	if (rebuildSummary) {
		const result = await consolidateSessionSummary({ existing: sessionSummary, events });
		if (result.ok) {
			db.update(campaigns)
				.set({ sessionSummary: result.text })
				.where(eq(campaigns.id, campaignId))
				.run();
		}
	}
}

/** Compact "ผู้เล่น: … / GM: …" digest of the last exchanges for consolidation. */
function recentExchangesText(campaignId: string, count: number): string {
	const rows = historyWindow(campaignId, count);
	if (rows.length === 0) return '';
	return rows
		.map((row) => `${row.role === 'player' ? 'ผู้เล่น' : 'GM'}: ${row.content}`)
		.join('\n---\n')
		.slice(0, 8000);
}

// ---------------------------------------------------------------------------
// Checkpoints — manual saves with note; restore auto-snapshots first
// (nothing is ever lost: the abandoned branch becomes its own checkpoint).
// ---------------------------------------------------------------------------

export const CHECKPOINT_CAP = 30;

export function listCheckpoints(campaignId: string) {
	const db = getDb();
	return db
		.select()
		.from(checkpoints)
		.where(eq(checkpoints.campaignId, campaignId))
		.orderBy(desc(checkpoints.createdAt))
		.limit(CHECKPOINT_CAP)
		.all()
		.map((row) => ({
			id: row.id,
			note: row.note,
			messagesUpTo: row.messagesUpTo,
			createdAt: row.createdAt,
			auto: Boolean((row.meta as { auto?: boolean } | null)?.auto)
		}));
}

/** A checkpoint archives the whole message branch, so restores are complete. */
interface ArchivedMessage {
	id: string;
	seq: number;
	role: 'player' | 'gm' | 'system';
	content: string;
	meta: Record<string, unknown> | null;
}

function insertCheckpoint(input: {
	campaignId: string;
	note: string;
	state: WorldState;
	messagesUpTo: number;
	auto: boolean;
}) {
	const db = getDb();
	// Cap: evict the oldest AUTO snapshot first, then oldest overall.
	const existing = db
		.select({ id: checkpoints.id, auto: checkpoints.meta })
		.from(checkpoints)
		.where(eq(checkpoints.campaignId, input.campaignId))
		.orderBy(checkpoints.createdAt)
		.all();
	if (existing.length >= CHECKPOINT_CAP) {
		const victim =
			existing.find((row) => (row.auto as { auto?: boolean } | null)?.auto) ?? existing[0];
		db.delete(checkpoints).where(eq(checkpoints.id, victim.id)).run();
	}
	const archived: ArchivedMessage[] = db
		.select({
			id: messages.id,
			seq: messages.seq,
			role: messages.role,
			content: messages.content,
			meta: messages.meta
		})
		.from(messages)
		.where(and(eq(messages.campaignId, input.campaignId), lte(messages.seq, input.messagesUpTo)))
		.orderBy(messages.seq)
		.all()
		.map((row) => ({
			id: row.id,
			seq: row.seq,
			role: row.role,
			content: row.content,
			meta: (row.meta as Record<string, unknown> | null) ?? null
		}));
	db.insert(checkpoints)
		.values({
			id: crypto.randomUUID(),
			campaignId: input.campaignId,
			note: input.note,
			stateJson: input.state,
			messagesUpTo: input.messagesUpTo,
			meta: { auto: input.auto, archivedMessages: archived }
		})
		.run();
}

export function createCheckpoint(campaignId: string, note: string) {
	const row = getCampaign(campaignId);
	if (!row) return null;
	const state = parseState(row.stateJson);
	if (!state) return null;
	const [{ maxSeq }] = getDb()
		.select({ maxSeq: sql<number>`coalesce(max(${messages.seq}), 0)` })
		.from(messages)
		.where(eq(messages.campaignId, campaignId))
		.all();
	insertCheckpoint({
		campaignId,
		note: note.slice(0, 120),
		state,
		messagesUpTo: maxSeq,
		auto: false
	});
	return true;
}

/** Restore a checkpoint: auto-snapshot the current branch, then swap state + trim messages. */
export function restoreCheckpoint(campaignId: string, checkpointId: string) {
	const db = getDb();
	const row = getCampaign(campaignId);
	if (!row) return { ok: false as const, error: 'ไม่พบการผจญภัย' };
	const current = parseState(row.stateJson);
	const [cp] = db.select().from(checkpoints).where(eq(checkpoints.id, checkpointId)).all();
	if (!cp || cp.campaignId !== campaignId) return { ok: false as const, error: 'ไม่พบจุดบันทึก' };

	const restored = parseState(cp.stateJson);
	if (!restored || !current) return { ok: false as const, error: 'สถานะในจุดบันทึกเสียหาย' };

	const [{ maxSeq }] = db
		.select({ maxSeq: sql<number>`coalesce(max(${messages.seq}), 0)` })
		.from(messages)
		.where(eq(messages.campaignId, campaignId))
		.all();

	// Auto-snapshot the branch we are about to leave — nothing is ever lost.
	if (maxSeq > cp.messagesUpTo) {
		insertCheckpoint({
			campaignId,
			note: 'สาขาก่อนย้อนเวลา (อัตโนมัติ)',
			state: current,
			messagesUpTo: maxSeq,
			auto: true
		});
	}

	// Swap the timeline: drop the current branch, replay the archived one.
	db.delete(messages).where(eq(messages.campaignId, campaignId)).run();
	const archived = (cp.meta as { archivedMessages?: ArchivedMessage[] } | null)?.archivedMessages;
	if (Array.isArray(archived) && archived.length > 0) {
		db.insert(messages)
			.values(
				archived.map((message) => ({
					id: message.id,
					campaignId,
					seq: message.seq,
					role: message.role,
					content: message.content,
					meta: message.meta
				}))
			)
			.run();
	}
	db.update(campaigns)
		.set({ stateJson: restored, ended: null, updatedAt: new Date(), lastPlayedAt: new Date() })
		.where(eq(campaigns.id, campaignId))
		.run();
	return { ok: true as const, state: restored };
}

// ---------------------------------------------------------------------------
// Level-up — app math only; the model never levels anyone.
// ---------------------------------------------------------------------------

export function levelUpCampaign(
	campaignId: string,
	allocations: Partial<Record<keyof Stats, number>>
): { ok: true; state: WorldState } | { ok: false; error: string } {
	const row = getCampaign(campaignId);
	if (!row) return { ok: false, error: 'ไม่พบการผจญภัย' };
	const state = parseState(row.stateJson);
	if (!state) return { ok: false, error: 'สถานะเสียหาย' };
	const hero = state.hero;

	const threshold = xpToNext(hero.level);
	if (hero.xp < threshold) {
		return { ok: false, error: `ยังเก็บระดับไม่ได้ (ต้องการอีก ${threshold - hero.xp} XP)` };
	}

	const spent = Object.values(allocations).reduce((sum, value) => sum + (value ?? 0), 0);
	if (spent !== 2) return { ok: false, error: 'ต้องแจกแต้มสถานะครบ 2 แต้ม' };

	const stats = { ...hero.stats };
	for (const key of STAT_KEYS) {
		const add = allocations[key] ?? 0;
		if (add < 0 || !Number.isInteger(add)) return { ok: false, error: 'แต้มไม่ถูกต้อง' };
		stats[key] = stats[key] + add;
		if (stats[key] > STAT_MAX) return { ok: false, error: `${key.toUpperCase()} เกิน 10 แล้ว` };
	}

	const pools = applyLevelUp(
		{ level: hero.level, hp: hero.hp, maxHp: hero.maxHp, mp: hero.mp, maxMp: hero.maxMp },
		stats.vit,
		stats.int
	);
	const leveled: WorldState = {
		...state,
		hero: {
			...hero,
			level: pools.level,
			xp: hero.xp - threshold,
			stats,
			hp: pools.hp,
			maxHp: pools.maxHp,
			mp: pools.mp,
			maxMp: pools.maxMp
		}
	};

	const db = getDb();
	db.update(campaigns)
		.set({ stateJson: leveled, updatedAt: new Date(), lastPlayedAt: new Date() })
		.where(eq(campaigns.id, campaignId))
		.run();
	return { ok: true, state: leveled };
}

// ---------------------------------------------------------------------------
// Rebirth — ประตูบานใหม่: a new hero steps into the SAME world (state persists)
// ---------------------------------------------------------------------------

export function rebirthCampaign(input: {
	campaignId: string;
	heroName: string;
	heroConcept: string;
	heroClass: string;
	proposal: HeroProposal;
}): string | null {
	const row = getCampaign(input.campaignId);
	if (!row) return null;
	const brief = parseBrief(row.worldBrief);
	const old = parseState(row.stateJson);
	if (!brief || !old) return null;

	const hero = heroFromProposal(
		{
			name: input.heroName.trim(),
			concept: input.heroConcept.trim(),
			klass: input.heroClass.trim() || 'นักผจญภัย'
		},
		input.proposal
	);

	// World persists; the hero (and their misfortunes) reset. Chronicle carries over.
	const state: WorldState = WorldStateSchema.parse({
		stateV: 1,
		hero,
		world: {
			...old.world,
			recentEvents: undefined
		},
		npcs: old.npcs,
		quests: old.quests.map((quest) =>
			quest.status === 'active' ? { ...quest, status: 'active', note: quest.note } : quest
		),
		recentEvents: [
			...old.recentEvents.slice(-6),
			`ประตูบานใหม่เปิดออก — ${hero.name} ก้าวเข้าสู่${brief.name}`
		]
	});

	const db = getDb();
	const id = crypto.randomUUID();
	db.insert(campaigns)
		.values({
			id,
			title: brief.name,
			setting: row.setting,
			tone: row.tone,
			worldBrief: row.worldBrief,
			stateJson: state,
			chronicle: row.chronicle
				? `${row.chronicle}\n\n**เหตุการณ์ใหญ่:** ฮีโร่คนก่อน (${old.hero.name}) เสียชีวิต — ${hero.name} ก้าวผ่านประตูบานใหม่`
				: row.chronicle,
			lastPlayedAt: new Date()
		})
		.run();
	return id;
}

// ---------------------------------------------------------------------------
// Choice-chip cache — stored on the GM message meta so reloads never re-call.
// ---------------------------------------------------------------------------

export function getLastGmMessage(campaignId: string) {
	const db = getDb();
	const [row] = db
		.select({ id: messages.id, content: messages.content, meta: messages.meta })
		.from(messages)
		.where(and(eq(messages.campaignId, campaignId), eq(messages.role, 'gm')))
		.orderBy(desc(messages.seq))
		.limit(1)
		.all();
	return row ?? null;
}

export function setMessageMeta(messageId: string, meta: Record<string, unknown>) {
	const db = getDb();
	db.update(messages).set({ meta }).where(eq(messages.id, messageId)).run();
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
