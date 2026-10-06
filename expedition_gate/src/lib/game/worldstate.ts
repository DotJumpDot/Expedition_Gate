/**
 * World-state v1 (Docs/03_WORLD_STATE.md) — the single source of truth about
 * "what is true in the game". Everything the LLM produces passes zod; the app
 * never trusts state unvalidated, wherever it came from.
 * ISOMORPHIC: imported by both server engine code and client components —
 * keep this module free of any node/env/db imports or it breaks the browser bundle.
 */
import { z } from 'zod';

/** Controlled vocabulary for world.sceneTag (assets/manifest.json tags, P4). */
export const SCENE_TAGS = [
	'gate',
	'village',
	'inn',
	'tavern',
	'market',
	'forest',
	'dungeon',
	'temple',
	'ruins',
	'cave',
	'mountain',
	'desert',
	'swamp',
	'river',
	'sea',
	'city',
	'street',
	'campfire',
	'night',
	'rain',
	'snow',
	'battle',
	'ritual',
	'workshop',
	'void'
] as const;

export type SceneTag = (typeof SCENE_TAGS)[number];

export const TimeOfDay = z.enum(['เช้า', 'สาย', 'บ่าย', 'เย็น', 'กลางคืน']);
export type TimeOfDay = z.infer<typeof TimeOfDay>;

const statValue = z.number().int().min(1).max(10);

export const StatsSchema = z.object({
	str: statValue,
	agi: statValue,
	dex: statValue,
	vit: statValue,
	int: statValue,
	spi: statValue,
	cha: statValue,
	luk: statValue
});
export type Stats = z.infer<typeof StatsSchema>;

export const EquipmentSchema = z.object({
	weapon: z
		.object({
			key: z.enum(['dagger', 'sword', 'axe', 'greatweapon', 'bow']),
			label: z.string().min(1)
		})
		.optional(),
	armor: z
		.object({
			key: z.enum(['none', 'cloth', 'leather', 'chain', 'plate']),
			label: z.string().min(1)
		})
		.optional(),
	accessory: z.string().optional()
});

export const HeroSchema = z.object({
	name: z.string().min(1).max(40),
	concept: z.string().max(300).default(''),
	klass: z.string().min(1).max(40),
	level: z.number().int().min(1).max(20).default(1),
	xp: z.number().int().min(0).default(0),
	stats: StatsSchema,
	hp: z.number().int().min(0),
	maxHp: z.number().int().min(1),
	mp: z.number().int().min(0),
	maxMp: z.number().int().min(1),
	conditions: z.array(z.string().max(60)).max(12).default([]),
	equipment: EquipmentSchema.default({}),
	inventory: z
		.array(
			z.object({
				name: z.string().min(1).max(60),
				qty: z.number().int().min(1),
				note: z.string().max(120).optional()
			})
		)
		.max(60)
		.default([]),
	gold: z.number().int().min(0).default(0),
	luckPoints: z.number().int().min(0).default(0)
});
export type Hero = z.infer<typeof HeroSchema>;

// --- client-safe constants & schemas (must stay in this isomorphic module:
// server/engine/gm.ts is server-only and cannot be imported by components) ---

export const SETTING_PRESETS = {
	sword_sorcery: 'ดาบและเวทมนตร์',
	scifi: 'ไซไฟ',
	horror: 'สยองขวัญ',
	thai_legend: 'ตำนานไทย (แถบอีสาน/ล้านนา)',
	custom: 'กำหนดเอง'
} as const;
export type SettingKey = keyof typeof SETTING_PRESETS;

export const HeroProposalSchema = z.object({
	stats: StatsSchema,
	weapon: z.object({
		key: z.enum(['dagger', 'sword', 'axe', 'greatweapon', 'bow']),
		label: z.string().min(1)
	}),
	armor: z.object({
		key: z.enum(['none', 'cloth', 'leather', 'chain', 'plate']),
		label: z.string().min(1)
	}),
	inventory: z
		.array(
			z.object({
				name: z.string().min(1),
				qty: z.number().int().min(1),
				note: z.string().optional()
			})
		)
		.min(1)
		.max(8),
	gold: z.number().int().min(0).max(500),
	background: z.string().min(1).max(900)
});
export type HeroProposal = z.infer<typeof HeroProposalSchema>;

export const NpcSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(60),
	role: z.string().max(60).default(''),
	disposition: z.number().int().min(-3).max(3).default(0),
	location: z.string().max(120).default(''),
	status: z.string().max(60).default('มีชีวิต'),
	note: z.string().max(200).optional()
});

export const QuestSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(120),
	status: z.enum(['active', 'done', 'failed']).default('active'),
	steps: z.array(z.string().max(160)).max(10).default([]),
	note: z.string().max(200).optional()
});

export const WorldSchema = z.object({
	day: z.number().int().min(1).default(1),
	timeOfDay: TimeOfDay.default('เช้า'),
	location: z.string().min(1).default('—'),
	weather: z.string().max(60).default(''),
	era: z.string().max(60).default(''),
	sceneTag: z.enum(SCENE_TAGS).default('gate'),
	flags: z.record(z.string(), z.boolean()).default({}),
	lore: z.array(z.string().max(200)).max(40).default([])
});

export const WorldStateSchema = z.object({
	stateV: z.literal(1).default(1),
	hero: HeroSchema,
	world: WorldSchema,
	npcs: z.array(NpcSchema).max(60).default([]),
	quests: z.array(QuestSchema).max(30).default([]),
	recentEvents: z.array(z.string().max(160)).max(20).default([]),
	/** Turn-level flag from the state tracker: this beat ended on a major decision. */
	majorDecision: z.boolean().default(false)
});
export type WorldState = z.infer<typeof WorldStateSchema>;

// ---------------------------------------------------------------------------
// Death saves (Docs/02: hero at 0 HP = dying — d20 ≥ 10 to stabilize, 3 tries).
// The app owns these markers; the state tracker copies them from `current`.
// ---------------------------------------------------------------------------

export const DEATH_SAVE_DC = 10;
export const DEATH_SAVE_MAX_FAILS = 3;

function deathMarker(count: number): string {
	return `นับความตาย ${count}`;
}

export function countDeathFails(conditions: string[]): number {
	let max = 0;
	for (const condition of conditions) {
		const match = condition.match(/^นับความตาย (\d)$/);
		if (match) max = Math.max(max, Number(match[1]));
	}
	return max;
}

/** App-owned condition patch after a death-save roll. */
export function deathConditionsAfter(
	conditions: string[],
	fails: number // 0 = stabilized (markers cleared), 1..3 = dying count
): string[] {
	const cleaned = conditions.filter((condition) => !/^นับความตาย \d$/.test(condition));
	return fails > 0 ? [...cleaned, deathMarker(fails)] : cleaned;
}

/** A saved state is truly dead only at 0 HP AND the third failed save. */
export function isHeroDead(hero: { hp: number; conditions: string[] }): boolean {
	return hero.hp === 0 && countDeathFails(hero.conditions) >= DEATH_SAVE_MAX_FAILS;
}

/**
 * App-wins merge for a consumed item (Docs/03 § update pipeline): the app
 * resolved the use against `resolvedFrom` (pre-tracker state), so the consumed
 * item's qty in the tracker output is FORCED to resolved−1 whatever the
 * tracker did with it (kept it, decremented it, or dropped it). Items the
 * tracker changed otherwise (loot, repairs) pass through untouched.
 */
export function mergeConsumed(
	resolvedFrom: Hero['inventory'],
	trackerInventory: Hero['inventory'],
	name: string
): Hero['inventory'] {
	const before = resolvedFrom.find((item) => item.name === name);
	if (!before) return trackerInventory; // nothing was consumed (resolveTurn guards too)
	const targetQty = before.qty - 1;

	const next = trackerInventory.map((item) =>
		item.name === name ? { ...item, qty: targetQty } : item
	);
	if (targetQty > 0 && !trackerInventory.some((item) => item.name === name)) {
		next.push({ ...before, qty: targetQty }); // tracker dropped it — restore at app qty
	}
	return targetQty > 0 ? next : next.filter((item) => item.name !== name); // last one consumed → gone
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export interface WorldBrief {
	name: string;
	terrain: string;
	situation: string;
	hooks: string[];
	npcs: Array<{ name: string; role: string }>;
}

export const WorldBriefSchema = z.object({
	name: z.string().min(1).max(80),
	terrain: z.string().min(1).max(900),
	situation: z.string().min(1).max(600),
	hooks: z.array(z.string().min(1).max(200)).min(1).max(5),
	npcs: z
		.array(z.object({ name: z.string().min(1).max(60), role: z.string().max(80).default('') }))
		.max(4)
		.default([])
});

export function initialWorldState(brief: WorldBrief, hero: Hero): WorldState {
	return WorldStateSchema.parse({
		stateV: 1,
		hero,
		world: {
			day: 1,
			timeOfDay: 'เช้า',
			location: brief.situation.slice(0, 100),
			weather: '',
			era: '',
			sceneTag: 'gate',
			flags: {},
			lore: [`${brief.name}: ${brief.terrain.slice(0, 160)}`]
		},
		npcs: brief.npcs.map((npc, i) => ({
			id: `npc-${i + 1}`,
			name: npc.name,
			role: npc.role,
			disposition: 0,
			location: '',
			status: 'มีชีวิต'
		})),
		quests: brief.hooks.slice(0, 1).map((hook, i) => ({
			id: `q-${i + 1}`,
			title: hook,
			status: 'active',
			steps: []
		})),
		recentEvents: [`เริ่มต้นการผจญภัยที่${brief.name}`]
	});
}

// ---------------------------------------------------------------------------
// Prompt serialization — compact Thai-labeled ground truth for the GM prompt.
// ---------------------------------------------------------------------------

const DISPOSITION_TH: Record<number, string> = {
	[-3]: 'เกลียดชัง',
	[-2]: 'ไม่พอใจ',
	[-1]: 'ระแวง',
	0: 'เป็นกลาง',
	1: 'เป็นมิตร',
	2: 'ไว้ใจ',
	3: 'ภักดี'
};

export function serializeWorldState(state: WorldState): string {
	const { hero, world, npcs, quests, recentEvents } = state;
	const lines: string[] = [];
	lines.push(
		`วันที่ ${world.day} (${world.timeOfDay}) · สถานที่: ${world.location}${world.weather ? ` · อากาศ: ${world.weather}` : ''}`
	);

	lines.push(
		`ฮีโร่: ${hero.name} (${hero.klass}) LV${hero.level} XP${hero.xp} · HP ${hero.hp}/${hero.maxHp} · มานา ${hero.mp}/${hero.maxMp} · ทอง ${hero.gold} · แต้มดวง ${hero.luckPoints}`
	);
	const statText = (Object.keys(hero.stats) as Array<keyof Stats>)
		.map((k) => `${k.toUpperCase()} ${hero.stats[k]}`)
		.join(' · ');
	lines.push(`ค่าสถานะ: ${statText}`);
	if (hero.conditions.length) lines.push(`สภาพ: ${hero.conditions.join(', ')}`);
	const equip = [
		hero.equipment.weapon?.label,
		hero.equipment.armor?.label,
		hero.equipment.accessory
	]
		.filter(Boolean)
		.join(' · ');
	if (equip) lines.push(`อุปกรณ์: ${equip}`);
	if (hero.inventory.length) {
		lines.push(`ของติดตัว: ${hero.inventory.map((item) => `${item.name}×${item.qty}`).join(', ')}`);
	}

	if (npcs.length) {
		lines.push('ตัวละคร NPC:');
		for (const npc of npcs.slice(0, 20)) {
			lines.push(
				`- ${npc.name}${npc.role ? ` (${npc.role})` : ''} · ${npc.status} · ความรู้สึกต่อฮีโร่: ${DISPOSITION_TH[npc.disposition] ?? 'เป็นกลาง'}`
			);
		}
	}
	if (quests.length) {
		const questTh: Record<string, string> = {
			active: 'กำลังทำ',
			done: 'สำเร็จ',
			failed: 'ล้มเหลว'
		};
		lines.push('เควส:');
		for (const quest of quests) {
			lines.push(`- [${questTh[quest.status]}] ${quest.title}`);
		}
	}
	if (world.flags && Object.keys(world.flags).length) {
		const on = Object.entries(world.flags)
			.filter(([, value]) => value)
			.map(([key]) => key);
		if (on.length) lines.push(`ธงเหตุการณ์: ${on.join(', ')}`);
	}
	if (world.lore.length) lines.push(`ความรู้ที่ค้นพบ: ${world.lore.slice(-8).join(' | ')}`);
	if (recentEvents.length) lines.push(`เหตุการณ์ล่าสุด: ${recentEvents.slice(-6).join(' | ')}`);
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Update pipeline helpers
// ---------------------------------------------------------------------------

export interface StateUpdateResult {
	state: WorldState;
	stale: boolean;
}

/**
 * Validate an LLM-proposed full-state rewrite. One retry with the error is the
 * caller's job; this is the accept/reject gate plus the authoritative merge:
 * app-applied mechanical mutations (appMath) ALWAYS win over the LLM's version.
 */
export function acceptStateUpdate(
	proposed: unknown,
	previous: WorldState,
	appMath: Partial<Pick<WorldState['hero'], 'hp' | 'mp' | 'gold' | 'luckPoints' | 'xp'>>
): StateUpdateResult | null {
	const parsed = WorldStateSchema.safeParse(proposed);
	if (!parsed.success) return null;

	let next = parsed.data;
	// App math wins — the model never overrides dice/HP/gold computed by the app.
	next = {
		...next,
		hero: { ...next.hero, ...stripUndefined(appMath) }
	};
	return { state: next, stale: false };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) out[key] = value;
	}
	return out as Partial<T>;
}
