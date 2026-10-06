/**
 * Prompt loader — prompts live in .md files (Docs/04), bundled via ?raw so
 * they ship with builds and stay editable without touching logic.
 */
import chronicle from './chronicle.md?raw';
import epilogue from './epilogue.md?raw';
import gm from './gm.md?raw';
import hero from './hero.md?raw';
import sessionSummary from './session-summary.md?raw';
import suggestions from './suggestions.md?raw';
import updateState from './update-state.md?raw';
import worldbrief from './worldbrief.md?raw';

export const PROMPTS = {
	gm,
	worldbrief,
	hero,
	updateState,
	sessionSummary,
	chronicle,
	suggestions,
	epilogue
};

/** Replace {{PLACEHOLDER}} tokens. Missing keys are left verbatim on purpose. */
export function fill(template: string, vars: Record<string, string>): string {
	let out = template;
	for (const [key, value] of Object.entries(vars)) {
		out = out.replaceAll(`{{${key}}}`, value);
	}
	return out;
}
