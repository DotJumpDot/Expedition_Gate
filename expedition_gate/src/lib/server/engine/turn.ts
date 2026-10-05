/**
 * Turn mechanics (Docs/02): the APP resolves declared mechanics server-side,
 * rolls dice, and hands the model a ready-made resolution line. The model
 * narrates resolved facts — it never rolls, never invents numbers.
 */
import {
	check,
	damage,
	describeCheck,
	WEAPONS,
	type CheckResult,
	type Rng,
	type StatKey,
	type WeaponKey
} from './rules';
import type { WorldState } from './worldstate';

export type TurnKind = 'free' | 'opening' | 'attack' | 'search' | 'talk' | 'flee' | 'roll';

export interface TurnInput {
	kind: TurnKind;
	text: string;
	/** For kind: 'roll' — stat + DC come from the dice tray. */
	stat?: StatKey;
	dc?: number;
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
	/** Structured roll record for the message meta (audit trail). */
	rolls?: Array<{
		kind: 'check' | 'damage';
		detail: CheckResult | { weapon: string; total: number };
	}>;
}

const QUICK_DC = { attack: 13, search: 15, talk: 15, flee: 13 } as const;

/** Resolve declared mechanics for a turn. Free/opening turns resolve nothing. */
export function resolveTurn(input: TurnInput, state: WorldState, rng: Rng): ResolvedTurn {
	const appMath: ResolvedTurn['appMath'] = {};

	if (input.kind === 'free' || input.kind === 'opening') {
		return { appMath };
	}

	if (input.kind === 'roll') {
		const stat: StatKey = input.stat ?? 'spi';
		const dc = input.dc ?? 15;
		const result = check(state.hero.stats[stat], dc, rng);
		return {
			resolutionLine: describeCheck(stat, result),
			appMath,
			rolls: [{ kind: 'check', detail: result }]
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
	const rolls: ResolvedTurn['rolls'] = [{ kind: 'check', detail: result }];

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
