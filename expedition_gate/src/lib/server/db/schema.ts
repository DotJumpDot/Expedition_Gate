/**
 * SQLite schema (Docs/03_WORLD_STATE.md).
 * All access through Drizzle parameterized calls — never string-built SQL.
 * `stateJson` is a JSON blob validated by zod at the engine layer, never trusted raw.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export type CampaignEnd = 'dead' | 'epilogue';
export type MessageRole = 'player' | 'gm' | 'system';

/** Message meta: {dice?, resolution?, stateDiff?, sugCache?} — shape owned by the engine. */
export type MessageMeta = Record<string, unknown>;

export const campaigns = sqliteTable('campaigns', {
	id: text('id').primaryKey(), // crypto.randomUUID(), app-generated
	title: text('title').notNull(),
	setting: text('setting').notNull(), // preset id (ดาบและเวทมนตร์ / ไซไฟ / …) or 'custom'
	tone: text('tone').notNull().default('[]'), // JSON array of tone tags
	worldBrief: text('world_brief').notNull().default(''), // JSON world-brief object (P1)
	stateJson: text('state_json', { mode: 'json' }).notNull().default('{}'),
	stateStale: integer('state_stale', { mode: 'boolean' }).notNull().default(false),
	stateV: integer('state_v').notNull().default(1), // world-state schema version
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	lastPlayedAt: integer('last_played_at', { mode: 'timestamp_ms' }),
	ended: text('ended', { enum: ['dead', 'epilogue'] })
});

export const messages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		seq: integer('seq').notNull(),
		role: text('role', { enum: ['player', 'gm', 'system'] }).notNull(),
		content: text('content').notNull(),
		meta: text('meta', { mode: 'json' }).$type<MessageMeta | null>(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('messages_campaign_seq_idx').on(table.campaignId, table.seq)]
);

export const checkpoints = sqliteTable(
	'checkpoints',
	{
		id: text('id').primaryKey(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		note: text('note').notNull().default(''),
		stateJson: text('state_json', { mode: 'json' }).notNull(),
		messagesUpTo: integer('messages_up_to').notNull(), // seq ceiling included in this snapshot
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('checkpoints_campaign_idx').on(table.campaignId)]
);
