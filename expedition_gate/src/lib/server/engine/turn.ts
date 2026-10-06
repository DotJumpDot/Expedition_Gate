/**
 * Turn mechanics (Docs/02): the APP resolves declared mechanics server-side,
 * rolls dice, and hands the model a ready-made resolution line. The model
 * narrates resolved facts — it never rolls, never invents numbers.
 */
import {
	check,
	damage,
	describeCheck,
	declaresCast,
	isUsableItem,
	itemEffect,
	potionAmount,
	rollDie,
	spellTier,
	SPELL_COSTS,
	WEAPONS,
	type CheckResult,
	type Rng,
	type StatKey,
	type WeaponKey
} from './rules';
import {
	DEATH_SAVE_DC,
	DEATH_SAVE_MAX_FAILS,
	deathConditionsAfter,
	countDeathFails,
	type WorldState
} from './worldstate';

export type TurnKind =
	'free' | 'opening' | 'attack' | 'search' | 'talk' | 'flee' | 'roll' | 'reroll' | 'use-item';

export interface TurnInput {
	kind: TurnKind;
	text: string;
	/** For kind: 'roll' — stat + DC come from the dice tray. */
	stat?: StatKey;
	dc?: number;
	/** For kind: 'use-item' — the exact inventory item name to consume. */
	item?: string;
}

export interface ResolvedTurn {
	/** Thai resolution line injected above the player input (or undefined). */
	resolutionLine?: string;
	/** App-computed hero values that override the state tracker this turn. */
	appMath: {
		hp?: number;
		mp?: number;
		gold?: number;
		xp?: number;
		luckPoints?: number;
	};
	/**
	 * App-owned condition patch (death-save markers) — applied to the state the
	 * tracker copies from AND merged over its output (app wins for its markers).
	 */
	appConditions?: string[];
	/**
	 * Item consumed by a 'use-item' turn — the turn route force-merges its qty
	 * over the tracker output (app wins, Docs/03).
	 */
	consume?: { name: string };
	/** Structured roll record for the message meta (audit trail). */
	rolls?: Array<
		| { kind: 'check'; stat: StatKey; detail: CheckResult }
		| { kind: 'damage'; detail: { weapon: string; total: number } }
		| { kind: 'death-save'; detail: CheckResult }
	>;
}

const QUICK_DC = { attack: 13, search: 15, talk: 15, flee: 13 } as const;

const TIER_LABEL_TH: Record<keyof typeof SPELL_COSTS, string> = {
	minor: 'เวทเล็ก',
	standard: 'เวทปกติ',
	major: 'เวทใหญ่'
};

/** Resolve declared mechanics for a turn. Free/opening turns resolve nothing. */
export function resolveTurn(input: TurnInput, state: WorldState, rng: Rng): ResolvedTurn {
	const appMath: ResolvedTurn['appMath'] = {};

	if (input.kind === 'opening') {
		return { appMath };
	}

	// Docs/02 death saves: at 0 HP the hero is dying — the app rolls d20 vs 10
	// each turn; success stabilizes at 1 HP, the third fail ends the campaign.
	// (First branch on purpose: a dying hero can't cast, drink, or reroll.)
	if (state.hero.hp === 0) {
		const die = rollDie(20, rng);
		const success = die >= DEATH_SAVE_DC;
		const fails = success
			? 0
			: Math.min(countDeathFails(state.hero.conditions) + 1, DEATH_SAVE_MAX_FAILS);
		const result: CheckResult = {
			die,
			mod: 0,
			total: die,
			dc: DEATH_SAVE_DC,
			outcome: success ? 'success' : 'fail',
			margin: die - DEATH_SAVE_DC
		};
		if (success) appMath.hp = 1;
		const line = success
			? `เช็คของรอดตาย (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(${die}) vs ${DEATH_SAVE_DC} → สำเร็จ ฮีโร่ดิ้นรนขึ้นมาได้และฟื้นคืนที่ 1 HP`
			: fails >= DEATH_SAVE_MAX_FAILS
				? `เช็คของรอดตาย (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(${die}) vs ${DEATH_SAVE_DC} → พลาดครบ ${DEATH_SAVE_MAX_FAILS} ครั้ง — ฮีโร่สิ้นใจ`
				: `เช็คของรอดตาย (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(${die}) vs ${DEATH_SAVE_DC} → พลาด (ครั้งที่ ${fails}/${DEATH_SAVE_MAX_FAILS}) ฮีโร่ยังรีบตัวเองอยู่`;
		return {
			resolutionLine: line,
			appMath,
			appConditions: deathConditionsAfter(state.hero.conditions, fails),
			rolls: [{ kind: 'death-save', detail: result }]
		};
	}

	// แต้มดวง (Docs/02 LUK): spend 1 to reroll the last check — fate twists.
	if (input.kind === 'reroll') {
		if (state.hero.luckPoints < 1) return { appMath }; // guard: nothing to spend
		const stat: StatKey = input.stat ?? 'luk';
		const dc = input.dc ?? 15;
		const result = check(state.hero.stats[stat], dc, rng);
		appMath.luckPoints = state.hero.luckPoints - 1;
		return {
			resolutionLine: `ใช้แต้มดวง 1 แต้ม — โชคพลิกกลับมา ทอยเช็คใหม่\n${describeCheck(stat, result)}`,
			appMath,
			rolls: [{ kind: 'check', stat, detail: result }]
		};
	}

	if (input.kind === 'use-item') {
		const name = input.item?.trim() ?? '';
		const found = name ? state.hero.inventory.find((entry) => entry.name === name) : undefined;
		// Unrecognized/unusable item: no app math — the GM narrates the use.
		if (!found || !isUsableItem(name)) return { appMath };
		const effect = itemEffect(name);
		const amount = potionAmount(effect, rng);
		if (effect === 'mana') {
			const mp = Math.min(state.hero.maxMp, state.hero.mp + amount);
			appMath.mp = mp;
			return {
				resolutionLine: `ใช้ไอเทม (ระบบคิดแล้ว): ${name} → ฟื้นมานา ${amount} (${state.hero.mp} → ${mp})`,
				appMath,
				consume: { name }
			};
		}
		const hp = Math.min(state.hero.maxHp, state.hero.hp + amount);
		appMath.hp = hp;
		return {
			resolutionLine: `ใช้ไอเทม (ระบบคิดแล้ว): ${name} → ฟื้นพลังชีวิต ${amount} (${state.hero.hp} → ${hp})`,
			appMath,
			consume: { name }
		};
	}

	if (input.kind === 'free') {
		// Declared spell (Docs/02): the app prices the cast and deducts มานา —
		// or refuses it when the pool is short. No roll; the GM narrates the rest.
		if (declaresCast(input.text)) {
			const tier = spellTier(input.text);
			const cost = SPELL_COSTS[tier];
			if (state.hero.mp >= cost) {
				appMath.mp = state.hero.mp - cost;
				return {
					resolutionLine: `การใช้เวท (ระบบหักมานาแล้ว): ${TIER_LABEL_TH[tier]} ใช้มานา ${cost} (เหลือ ${state.hero.mp - cost}/${state.hero.maxMp})`,
					appMath
				};
			}
			return {
				appMath,
				resolutionLine: `การใช้เวทไม่สำเร็จ: มานาไม่พอ — มีอยู่ ${state.hero.mp} แต่ต้องใช้ ${cost} เวทจึงดับกลางคัน ไม่มีอะไรเกิดขึ้น`
			};
		}
		return { appMath };
	}

	if (input.kind === 'roll') {
		const stat: StatKey = input.stat ?? 'spi';
		const dc = input.dc ?? 15;
		const result = check(state.hero.stats[stat], dc, rng);
		return {
			resolutionLine: describeCheck(stat, result),
			appMath,
			rolls: [{ kind: 'check', stat, detail: result }]
		};
	}

	// Quick actions: fixed stat families, DC per Docs/02 defaults.
	const statFor: Record<'attack' | 'search' | 'talk' | 'flee', StatKey> = {
		attack: weaponStat(state),
		search: 'spi',
		talk: 'cha',
		flee: 'agi'
	};
	const stat = statFor[input.kind];
	const dc = QUICK_DC[input.kind];
	const result = check(state.hero.stats[stat], dc, rng);
	const rolls: ResolvedTurn['rolls'] = [{ kind: 'check', stat, detail: result }];

	// A landed attack rolls weapon damage too (narrated against the target;
	// enemy bookkeeping lives in the state tracker, not app math).
	if (input.kind === 'attack' && (result.outcome === 'success' || result.outcome === 'crit')) {
		const weaponKey: WeaponKey = state.hero.equipment.weapon?.key ?? 'sword';
		const crit = result.outcome === 'crit';
		const roll1 = damage(weaponKey, rng, state.hero.stats.str);
		const dmg = crit
			? roll1.total + damage(weaponKey, rng, state.hero.stats.str).total
			: roll1.total;
		const weaponLabel = state.hero.equipment.weapon?.label ?? WEAPONS[weaponKey].labelTh;
		return {
			resolutionLine: `${describeCheck(stat, result)}\nความเสียหาย (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): ${weaponLabel} โดนรวม ${dmg} บาดแผล${crit ? ' (ขวัญตา ×2)' : ''}`,
			appMath,
			rolls: [...rolls, { kind: 'damage', detail: { weapon: weaponKey, total: dmg } }]
		};
	}

	return { resolutionLine: describeCheck(stat, result), appMath, rolls };
}

/** Melee weapons swing on STR, the bow on DEX. */
function weaponStat(state: WorldState): StatKey {
	return state.hero.equipment.weapon?.key === 'bow' ? 'dex' : 'str';
}
