import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '$lib/server/db/client';
import { campaigns, messages } from '$lib/server/db/schema';

describe('db client + schema', () => {
	it('runs migrations and stores a campaign row (JSON columns round-trip)', () => {
		const db = createTestDb();
		const state = { hero: { name: 'ตะวัน' }, day: 1 };
		db.insert(campaigns)
			.values({
				id: 'c1',
				title: 'ทุ่งประตูหิน',
				setting: 'sword_sorcery',
				tone: '["มืดมน"]',
				stateJson: state
			})
			.run();

		const [row] = db.select().from(campaigns).where(eq(campaigns.id, 'c1')).all();
		expect(row.title).toBe('ทุ่งประตูหิน');
		expect(row.stateJson).toEqual(state);
		expect(row.ended).toBeNull();
	});

	it('enforces unique (campaignId, seq) for messages', () => {
		const db = createTestDb();
		db.insert(campaigns).values({ id: 'c2', title: 'โลกทดสอบ', setting: 'custom' }).run();
		db.insert(messages)
			.values({ id: 'm1', campaignId: 'c2', seq: 1, role: 'player', content: 'สวัสดี' })
			.run();

		expect(() =>
			db
				.insert(messages)
				.values({ id: 'm2', campaignId: 'c2', seq: 1, role: 'gm', content: 'ทำซ้ำ seq' })
				.run()
		).toThrowError(/unique/i);
	});

	it('cascades message deletion when a campaign is deleted', () => {
		const db = createTestDb();
		db.insert(campaigns).values({ id: 'c3', title: 'โลกลบทิ้ง', setting: 'custom' }).run();
		db.insert(messages)
			.values({ id: 'm3', campaignId: 'c3', seq: 1, role: 'system', content: 'เริ่มต้น' })
			.run();

		db.delete(campaigns).where(eq(campaigns.id, 'c3')).run();
		const remaining = db.select().from(messages).where(eq(messages.campaignId, 'c3')).all();
		expect(remaining).toHaveLength(0);
	});
});
