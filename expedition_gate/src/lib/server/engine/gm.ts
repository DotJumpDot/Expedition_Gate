/**
 * GM prompt assembly (Docs/04) + the JSON-call helper with the one-retry
 * pattern (fillcard): strict instruction → zod parse → ONE retry feeding the
 * parse error back → give up with a typed failure, never a crash.
 */
import { z } from 'zod';
import type { ChatMessage } from '../llama';
import { complete } from '../llama';
import { PROMPTS, fill } from '../prompts';
import { buildMemory, windowToChatMessages, type MemorySlice } from './memory';
import {
	SCENE_TAGS,
	serializeWorldState,
	WorldBriefSchema,
	WorldStateSchema,
	type WorldBrief,
	type WorldState
} from './worldstate';

export interface GmTurnContext {
	brief: WorldBrief;
	state: WorldState;
	history: Array<{ role: string; content: string }>;
	/** Resolved mechanics line for THIS turn (dice already rolled by the app). */
	resolutionLine?: string;
	playerInput: string;
	/** Opening scene: narrate the campaign's first beat instead of reacting. */
	opening?: boolean;
}

/** Assemble the full GM message array (system + history + turn user message). */
export function buildGmMessages(ctx: GmTurnContext): ChatMessage[] {
	const memory: MemorySlice = buildMemory(ctx.history);

	const system = fill(PROMPTS.gm, {
		WORLD_BRIEF: briefText(ctx.brief),
		WORLD_STATE: serializeWorldState(ctx.state),
		MEMORY: memory.summaryText || '（เพิ่งเริ่มต้นการผจญภัย — ยังไม่มีเหตุการณ์ก่อนหน้า）'
	});

	const quickFacts = `วันที่ ${ctx.state.world.day} (${ctx.state.world.timeOfDay}) · ${ctx.state.world.location}`;

	const userParts: string[] = [];
	if (ctx.opening) {
		userParts.push(
			'【คำสั่งระบบ】 นี่คือเทิร์นเปิดเรื่อง — เล่าฉากเปิดของการผจญภัยตามจุดเริ่มเรื่องในสรุปโลก จบด้วยจังหวะที่ฮีโร่ต้องเลือกทำอะไรสักอย่าง'
		);
	} else {
		if (ctx.resolutionLine) userParts.push(ctx.resolutionLine);
		userParts.push(quickFacts);
		userParts.push(`ผู้เล่น: ${ctx.playerInput}`);
	}

	return [
		{ role: 'system', content: system },
		...windowToChatMessages(memory.window),
		{ role: 'user', content: userParts.join('\n') }
	];
}

export function briefText(brief: WorldBrief): string {
	const lines = [
		`โลก: ${brief.name}`,
		brief.terrain,
		`จุดเริ่มเรื่อง: ${brief.situation}`,
		`ตะขอเรื่อง: ${brief.hooks.map((hook) => `• ${hook}`).join(' ')}`
	];
	if (brief.npcs.length) {
		lines.push(`NPC เริ่มต้น: ${brief.npcs.map((npc) => `${npc.name} (${npc.role})`).join(' · ')}`);
	}
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// JSON background calls (world brief / hero proposal / state update)
// ---------------------------------------------------------------------------

async function completeJson(
	messages: ChatMessage[],
	schema: z.ZodTypeAny,
	opts: { maxTokens?: number; timeoutMs?: number; baseUrl?: string } = {}
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
	const ask = async (extraNote?: string): Promise<string> => {
		const result = await complete({
			messages: extraNote ? [...messages, { role: 'user', content: extraNote }] : messages,
			temperature: 0.4,
			maxTokens: opts.maxTokens ?? 2048,
			timeoutMs: opts.timeoutMs ?? 120_000,
			baseUrl: opts.baseUrl
		});
		return result.content;
	};

	let raw = await ask();
	let parsed = schema.safeParse(parseJsonLoose(raw));
	if (parsed.success) return { ok: true, data: parsed.data };

	// ONE retry with the parse error fed back (sibling-app fillcard pattern).
	raw = await ask(
		`คำตอบก่อนหน้าไม่ใช่ JSON ที่ถูกต้อง: ${parsed.error.issues
			.slice(0, 3)
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ')}\nตอบใหม่เป็น JSON เท่านั้นตามโครงเดิม`
	);
	parsed = schema.safeParse(parseJsonLoose(raw));
	if (parsed.success) return { ok: true, data: parsed.data };

	return {
		ok: false,
		error: parsed.error.issues
			.slice(0, 3)
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ')
	};
}

/** Tolerant JSON extraction: strips code fences / stray prose around the object. */
export function parseJsonLoose(raw: string): unknown {
	const text = raw.trim();
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = fenced ? fenced[1] : text;
	const start = candidate.indexOf('{');
	const end = candidate.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return undefined;
	try {
		return JSON.parse(candidate.slice(start, end + 1));
	} catch {
		return undefined;
	}
}

// --- world brief -----------------------------------------------------------

export const SETTING_PRESETS = {
	sword_sorcery: 'ดาบและเวทมนตร์',
	scifi: 'ไซไฟ',
	horror: 'สยองขวัญ',
	thai_legend: 'ตำนานไทย (แถบอีสาน/ล้านนา)',
	custom: 'กำหนดเอง'
} as const;
export type SettingKey = keyof typeof SETTING_PRESETS;

export async function generateWorldBrief(
	input: { setting: SettingKey; tone: string[]; premise?: string },
	baseUrl?: string
): Promise<{ ok: true; brief: WorldBrief } | { ok: false; error: string }> {
	const prompt = fill(PROMPTS.worldbrief, {
		SETTING: SETTING_PRESETS[input.setting],
		PREMISE: input.premise ? ` โดยมีแนวคิดเรื่องจากผู้เล่น: "${input.premise}"` : '',
		TONE: input.tone.join(' · ') || 'ผจญภัย'
	});
	const result = await completeJson([{ role: 'user', content: prompt }], WorldBriefSchema, {
		baseUrl,
		maxTokens: 1500
	});
	if (!result.ok) return { ok: false, error: result.error };
	return { ok: true, brief: result.data as WorldBrief };
}

// --- hero proposal ---------------------------------------------------------

export const HeroProposalSchema = z.object({
	stats: WorldStateSchema.shape.hero.shape.stats,
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

export async function generateHeroProposal(
	input: { brief: WorldBrief; name: string; concept: string; klass: string },
	baseUrl?: string
): Promise<{ ok: true; proposal: HeroProposal } | { ok: false; error: string }> {
	const prompt = fill(PROMPTS.hero, {
		WORLD_NAME: input.brief.name,
		WORLD_SITUATION: input.brief.situation,
		HERO_NAME: input.name || 'นักสำรวจนรนาเมก',
		HERO_CONCEPT: input.concept || 'นักผจญภัยผู้มุ่งหน้าข้ามประตู',
		HERO_CLASS: input.klass
	});
	const result = await completeJson([{ role: 'user', content: prompt }], HeroProposalSchema, {
		baseUrl,
		maxTokens: 1200
	});
	if (!result.ok) return { ok: false, error: result.error };
	return { ok: true, proposal: result.data as HeroProposal };
}

// --- state update ----------------------------------------------------------

export interface AppMath {
	hp?: number;
	mp?: number;
	gold?: number;
	xp?: number;
	luckPoints?: number;
}

export async function updateWorldState(input: {
	current: WorldState;
	playerInput: string;
	narration: string;
	appMath?: AppMath;
	baseUrl?: string;
}): Promise<{ ok: true; state: WorldState } | { ok: false; error: string }> {
	const prompt = fill(PROMPTS.updateState, {
		CURRENT_STATE: JSON.stringify(input.current),
		PLAYER_INPUT: input.playerInput,
		NARRATION: input.narration.slice(0, 6000),
		APP_MATH: JSON.stringify(input.appMath ?? {}),
		SCENE_TAGS: SCENE_TAGS.join(' · ')
	});
	const result = await completeJson([{ role: 'user', content: prompt }], WorldStateSchema, {
		baseUrl: input.baseUrl,
		maxTokens: 4000,
		timeoutMs: 180_000
	});
	if (!result.ok) return { ok: false, error: result.error };

	const next = result.data as WorldState;
	// Authoritative merge: app math wins over whatever the tracker proposed.
	const hero = { ...next.hero, ...stripUndefined(input.appMath ?? {}) };
	return { ok: true, state: { ...next, hero } };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) out[key] = value;
	}
	return out as Partial<T>;
}
