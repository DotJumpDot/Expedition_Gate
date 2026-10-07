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

export interface SettingPreset {
	key: string;
	label: string;
	/** Steering paragraph injected into the world-brief prompt (empty = player premise only). */
	description: string;
	/** Scene-art bucket — which library group illustrates this world. */
	art: 'sword_sorcery' | 'scifi' | 'horror' | 'thai_legend' | 'any';
	icon: string;
}

/**
 * Built-in world presets. The label names the stage; the description is what
 * actually steers the GM's world brief (sent as the player premise), so each
 * one reads like a story hook, not a genre tag. Players can save their own
 * presets on top of these (settings store → wizard chips).
 */
export const SETTING_PRESETS: Record<string, SettingPreset> = {
	sword_sorcery: {
		key: 'sword_sorcery',
		label: 'ดาบและเวทมนตร์',
		description:
			'ทวีปคลาสสิกแห่งราชอาณาจักร อัศวิน มังกร และเวทมนตร์โบราณ หอคอยพ่อมด ป่าหวงห้าม และสงครามระหว่างอาณาจักร การผจญภัยสวมบทแบบตะวันตกเต็มรูปแบบ',
		art: 'sword_sorcery',
		icon: '⚔️'
	},
	magic_academy: {
		key: 'magic_academy',
		label: 'สถาบันเวทมนตร์',
		description:
			'หอเรียนเวทมนตร์อันดับหนึ่งที่ชนชั้นสูงผูกขาดไว้ ผู้เล่นคือนักเรียนผู้ยากจนหรือตกหล่นที่ต้องไต่จากล่างสุดสู่อันดับต้นด้วยการสอบเวท ดวลเวทระหว่างชั้นปี แก๊งอิทธิพลในสถาบัน หอสมุดต้องห้าม และครูผู้ซ่อนอดีตไว้ใต้อาภรณ์',
		art: 'sword_sorcery',
		icon: '🎓'
	},
	frozen_north_noble: {
		key: 'frozen_north_noble',
		label: 'ขุนนางแดนน้ำแข็ง',
		description:
			'ผู้เล่นกลับชาติมาเกิดเป็นทายาทหนุ่มสาวแห่งตระกูลขุนนางผู้ครองแคว้นเหนือกึ๊กขั้วโลก ปราสาทบนภูเขาน้ำแข็ง การเมืองระหว่างตระกูล สัตว์อสูรแดนเยือกเย็น และเวทมนตร์น้ำแข็งที่ไหลอยู่ในสายเลือด ทุกสายตาในแคว้นจ้องดูว่าทายาทคนใหม่จะแข็งแกร่งพอหรือไม่',
		art: 'sword_sorcery',
		icon: '❄️'
	},
	system_power: {
		key: 'system_power',
		label: 'ระบบพลังลับ',
		description:
			'หนึ่งวันผู้เล่นตื่นขึ้นมาพร้อม "ระบบ" ที่มีเพียงผู้เดียวที่มองเห็น — ภารกิจ ค่าประสบการณ์ สกิล และร้านค้าลับปรากฏขึ้นหน้าตาเหมือนเกม ทั้งที่โลกรอบตัวเป็นโลกจริงที่ไม่มีใครมีสิ่งนี้ ความลับนี้เป็นทั้งพลังและหายนะถ้าใครรู้',
		art: 'any',
		icon: '💠'
	},
	fallen_noble_sword: {
		key: 'fallen_noble_sword',
		label: 'ขุนนางตกอับ นักดาบพเนจร',
		description:
			'ตระกูลขุนนางถูกโค่นล้มในคืนเดียว ที่ดินถูกยึด ชื่อกลายเป็นคำสาป ผู้เล่นคือบุตรผู้รอดพ้นจากไฟไหม้คืนนั้น ถือดาบประจำตระกูลเพียงเล่มเดียว ออกเดินทางในฐานะนักดาบรับจ้าง หาทางฟื้นเกียรติยศและเฉลยว่าใครอยู่เบื้องหลังการล่มสลาย',
		art: 'sword_sorcery',
		icon: '🗡️'
	},
	time_control: {
		key: 'time_control',
		label: 'ผู้สั่งการเวลา',
		description:
			'ในมหานครแสนวุ่นวาย ผู้เล่นครอบครองพลังหยุดและย้อนเวลาได้ไม่กี่วินาที แต่ทุกครั้งมีราคาที่ต้องจ่าย องค์กรลับได้กลิ่น ผู้มีอิทธิพลต้องการพลังนี้ไปครอง และเส้นเวลาที่ถูกพลิกซ้ำแล้วซ้ำเล่ากำลังแยกรอยแยกที่โลกไม่ควรมองเห็น',
		art: 'any',
		icon: '⏳'
	},
	eastern_empire: {
		key: 'eastern_empire',
		label: 'ราชสำนักจักรวรรดิตะวันออก',
		description:
			'จักรวรรดิกลิ่นอายยุโรปตะวันออก พระราชวังหิมะ แม่ทัพผู้เกรียงไกร และเวทมนตร์สายเลือดโบราณของชนชั้นสูง ราชสำนักเต็มไปด้วยการวางแผนชิงบัลลังก์ ทุกจานเลี้ยงอาจมีพิษ ทุกคำสัญญามีด้านมืด และผู้เล่นเพิ่งถูกดึงเข้าไปอยู่กลางเกมอำนาจนี้',
		art: 'sword_sorcery',
		icon: '🏰'
	},
	wuxia: {
		key: 'wuxia',
		label: 'จอมยุทธ์บู๊ลิ้ม',
		description:
			'โลกยุทธจักรแห่งหุบเขาและเมืองโบราณ นิกายใหญ่น้อยแย่งชิงตำราลับและตำแหน่งจอมยุทธ์อันดับหนึ่ง ผู้เล่นคือนักสู้รุ่นใหม่ที่ต้องฝึกฝนศาสตร์ แก้แค้นตระกูล เลือกข้างระหว่างนิกาย และเผชิญโลกนอกยุทธจักรที่ไม่เคยยุติธรรม',
		art: 'sword_sorcery',
		icon: '🥋'
	},
	demon_lord_reborn: {
		key: 'demon_lord_reborn',
		label: 'ผู้กลับชาติเป็นจอมมาร',
		description:
			'ผู้เล่นลืมตาขึ้นในร่างของจอมมารที่โลกทั้งใบกลัวและเกลียดชัง กองทัพผนึกมารกำลังเดินทัพมาถึง ขุนนางมารในปราสาทแย่งอำนาจกันเอง และความทรงจำของเจ้าของร่างเดิมยังหลงเหลืออยู่ — ทางเลือกเปิดกว้างว่าจะเป็นจอมมารแบบไหน',
		art: 'sword_sorcery',
		icon: '😈'
	},
	pirate_sea: {
		key: 'pirate_sea',
		label: 'ราชาโจรสลัดมหาสมุทร',
		description:
			'ทะเลพันเกาะแห่งกัปตันโจร สมบัติในตำนาน และเรือปริศนาที่ล่องหนกลางหมอก ผู้เล่นเริ่มต้นด้วยเรือเล็กหนึ่งลำและลูกเรือไม่กี่คน ออกล่าแผนที่สมบัติ หลบกองเรือราชนาวี ต่อรองกับเมืองท่าไร้กฎหมาย และเผชิญอสูรทะเลที่ไม่มีใครเชื่อว่ามีจริง',
		art: 'any',
		icon: '🏴‍☠️'
	},
	post_apoc: {
		key: 'post_apoc',
		label: 'โลกหลังวันสิ้นโลก',
		description:
			'อารยธรรมล่มสลายไปแล้ว เมืองร้างถูกฝุ่นกลืน สัตว์กลายพันธุ์ครองถนน เหลือเพียงกลุ่มผู้รอดชีวิตแย่งกันหาน้ำสะอาดและซากเทคโนโลยี ผู้เล่นคือนักสำรวจที่เพิ่งขุดพบสิ่งประดิษฐ์ที่อาจเขียนกฎของโลกใหม่ทั้งใบได้',
		art: 'scifi',
		icon: '☢️'
	},
	steampunk: {
		key: 'steampunk',
		label: 'จักรกลไอน้ำกับเวทมนตร์',
		description:
			'มหานครที่ไอน้ำ ฟันเฟือง และอาคมขับเคลื่อนกันอยู่ ชนชั้นสูงขี่เรือเหาะเหนือเมฆ ชนชั้นล่างขุดแร่อาคมใต้ดิน ผู้เล่นคือช่างซ่อมจักรกลที่บังเอิญพบแกนเวทมนตร์ต้องสาปซึ่งทั้งบรรษัทใหญ่และราชสำนักต้องการไปครองไม่ว่าจะด้วยวิธีใด',
		art: 'scifi',
		icon: '⚙️'
	},
	scifi: {
		key: 'scifi',
		label: 'ไซไฟ',
		description:
			'อนาคตไกลแห่งยานอวกาศ ดาวเคราะห์แปลกใหม่ ปัญญาประดิษฐ์ และเผ่าพันธุ์ต่างดาว สงครามระหว่างดวงดาวกับความลับของจักรวาลรอผู้กล้าอยู่ในห้วงดาว',
		art: 'scifi',
		icon: '🚀'
	},
	horror: {
		key: 'horror',
		label: 'สยองขวัญ',
		description:
			'หมู่บ้านที่ความตายไม่จบสิ้น คฤหาสน์ผีสิง คำสาบตกทอดข้ามตระกูล และสิ่งที่จ้องกลับมาจากความมืด เรื่องเล่าที่อาจไม่มีใครรอดกลับมาเล่าให้ฟัง',
		art: 'horror',
		icon: '👻'
	},
	thai_legend: {
		key: 'thai_legend',
		label: 'ตำนานไทย (อีสาน/ล้านนา)',
		description:
			'แดนพื้นบ้านไทยตามความเชื่อโบราณ พระเครื่อง ผีปอบ นาคราช หมอผี และป่าลึกที่ห้ามผู้ใดล้ำเดี่ยว ความเชื่อ ความขลัง และสายสัมพันธ์ของคนกับสิ่งที่มองไม่เห็น',
		art: 'thai_legend',
		icon: '🪔'
	},
	custom: {
		key: 'custom',
		label: 'กำหนดเอง',
		description: '',
		art: 'any',
		icon: '✍️'
	}
};

/** Campaign setting key — any preset key; user presets all persist as 'custom'. */
export type SettingKey = string;

/** Preset lookup that never throws — unknown keys (old saves, imports) fall back to custom. */
export function settingPreset(key: string): SettingPreset {
	return SETTING_PRESETS[key] ?? SETTING_PRESETS.custom;
}

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
	role: z.string().max(100).default(''),
	disposition: z.number().int().min(-3).max(3).default(0),
	location: z.string().max(120).default(''),
	status: z.string().max(60).default('มีชีวิต'),
	note: z.string().max(200).optional(),
	/** GM's one-line appearance hint — matched app-side to a library portrait. */
	portrait: z.string().max(120).default('')
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
	terrain: z.string().min(1).max(1600),
	situation: z.string().min(1).max(1200),
	hooks: z.array(z.string().min(1).max(300)).min(1).max(5),
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
	next = { ...next, npcs: carryNpcExtras(next.npcs, previous.npcs) };
	return { state: next, stale: false };
}

/**
 * The state serialization never shows `portrait` (and usually not `note`) to
 * the tracker, so it cannot copy what it cannot see — an omitted field would
 * silently wipe it every turn. Carry each previous NPC's extras onto its
 * successor (match by id, then name); a NEW hint the tracker wrote wins.
 */
function carryNpcExtras(
	proposed: WorldState['npcs'],
	previous: WorldState['npcs']
): WorldState['npcs'] {
	if (previous.length === 0) return proposed;
	const byId = new Map(previous.map((npc) => [npc.id, npc]));
	const byName = new Map(previous.map((npc) => [npc.name, npc]));
	return proposed.map((npc) => {
		if (npc.portrait.trim()) return npc;
		const was = byId.get(npc.id) ?? byName.get(npc.name);
		return was?.portrait || was?.note
			? {
					...npc,
					portrait: npc.portrait || was.portrait,
					note: npc.note ?? was.note
				}
			: npc;
	});
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) out[key] = value;
	}
	return out as Partial<T>;
}
