/**
 * Shim — the real implementation lives in the ISOMORPHIC module
 * `$lib/game/worldstate` (client components import it directly; SvelteKit
 * forbids value imports from `$lib/server/**` in browser code). Server-side
 * callers keep importing from here for a stable path.
 */
export * from '$lib/game/worldstate';
