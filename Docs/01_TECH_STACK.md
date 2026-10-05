# 01 — Tech Stack

## Why SvelteKit (and not Next.js / Astro)

The user's requirement: one framework handling **backend + frontend together**, a real UI/animation library (no hand-rolled single-file HTML), SQLite, and Jest-class testing. He flagged Next.js as feeling "heavy and slow" and floated SvelteKit or Astro.

- **SvelteKit 2** — chosen. One project: Svelte components for UI, `+page.server.ts` / `+server.ts` routes for the backend, Vite under the hood (fast dev server, instant HMR). Ships the *smallest* runtime of the big three — a local game wants snappy, not heavy. Transitions are a first-class language feature.
- **Next.js (React)** — rejected. Heavier dev experience, React's runtime + hydration cost buys nothing for a single-player local app, and its Jest-era testing story is exactly the "old and heavy" feeling he reacted against.
- **Astro** — rejected. Content-site oriented (blogs, docs, marketing). A constantly-interactive game UI would end up as Svelte islands inside Astro scaffolding — paying for a framework that isn't doing the work.

**The Jest → Vitest swap (be able to explain this):** Jest is React-ecosystem-bound; its Svelte adapter (svelte-jester) is stale for Svelte 5 runes. **Vitest is the Svelte-native standard with the same API** (`describe / it / expect`, mocks, snapshots, coverage), Vite-powered so it shares SvelteKit's pipeline. The user asked for "Jest testing" meaning that *class* of testing — Vitest delivers it. Do not install Jest.

## The stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **SvelteKit 2, Svelte 5 (runes)** | `$state / $derived / $effect` — no stores needed |
| Language | **TypeScript, strict** | No `any` in domain code |
| Styling | **Tailwind CSS** | Design tokens in CSS vars, dark-fantasy theme |
| UI kit | **shadcn-svelte** (bits-ui) | Dialog, sheet, tabs, toast, select — owns a11y; copy-in components we can theme |
| Animation | **svelte/transition** + **motion** (motion.dev) | `motion` has official Svelte support; use for spring/physics gestures, svelte/transition for enter/leave |
| Forms | **Superforms** + zod | SvelteKit-native form validation; ONE zod schema shared client + server (creation wizards, settings) |
| SSE client | **@microsoft/fetch-event-source** | browser-side SSE over POST with abort/retry — native EventSource can't POST; used for the GM turn stream |
| Icons | **@lucide/svelte** | UI chrome icons; in-game action icons stay emoji (matches the sibling app's tone) |
| Database | **better-sqlite3** (WAL) + **Drizzle ORM** | Sync driver is fine for single-user; Drizzle = typed schema + **parameterized queries only** |
| Validation | **zod** | World-state JSON, API bodies, LLM JSON outputs |
| AI client | hand-rolled `fetch` wrapper | OpenAI-compatible `/v1/chat/completions`; stream + non-stream; **the browser never talks to llama-server directly** — SvelteKit server routes proxy it (same pattern as Novel's Model) |
| Testing | **Vitest** + **@testing-library/svelte** + happy-dom | Unit + component; MSW or `vi.stubGlobal('fetch')` for LLM mocks; Playwright added at P3 for e2e |
| Env | `.env` → `LLAMA_URL` (default `http://127.0.0.1:8080/v1`), `PORT` | Never commit `.env` |

## State management — no Zustand, no query lib (decided 2026-10-06)

The user asked whether we need a Zustand-class store. **No — it wouldn't even work**: Zustand is React-coupled, and Svelte 5 runes ARE the store, natively, via `.svelte.ts` modules:

```ts
// lib/stores/campaign.svelte.ts
export const campaign = $state({ id: null, state: null, messages: [] });
export function applyTurnResult(s, msgs) {
  campaign.state = s;      // every HeroSheet/QuestLog/StatBlock reacts automatically
  campaign.messages.push(...msgs);
}
```

The server (SQLite) is the source of truth; the client rune store is a reactive mirror refreshed per turn — ~30 lines, zero dependencies. **TanStack Query is deliberately absent too**: it exists to manage remote-API caching, and everything here is localhost with ~0 latency plus SSE push — `+page.server.ts load()` + runes covers all of it.

Deliberately NOT adopted (don't add without updating this section first): markdown renderers (the narration renderer is a hand-built core asset, sibling-app lineage — dialogue splitting rules don't survive markdown), i18n (Thai-only UI by design), uuid/dayjs (`crypto.randomUUID()` / `Intl` built-ins), a state machine lib (a `phase` string enum suffices for the campaign lifecycle). Virtualization door: when campaigns grow long, either render-cap the narration column (last N blocks + "โหลดย้อนหลัง" button — the v1 choice) or adopt @tanstack/virtual.

## Project structure (created at P0)

The app lives in `expedition_gate/` at the repo root (user decision 2026-10-06 — root keeps only `AGENTS.md`, `README.md`, `Docs/`). All paths below are relative to `expedition_gate/`.

```
src/
├── routes/
│   ├── +layout.svelte                ← app shell (campaign list / campaign view switch)
│   ├── /                             ← Gate screen: campaign list + "สร้างโลกใหม่"
│   ├── /campaign/[id]/+page.svelte   ← the game screen (narration | hero sheet | quests)
│   └── api/
│       ├── +server.ts …
│       ├── /api/campaigns/*.ts       ← CRUD: create world, list, delete, checkpoints
│       ├── /api/gm/turn.ts           ← POST: player input → (mechanics) → GM stream (SSE)
│       ├── /api/gm/stop.ts           ← POST: abort in-flight turn (flag polled per delta)
│       ├── /api/dice.ts              ← POST: roll (server-side RNG, returns roll + resolution)
│       └── /api/llama/health.ts      ← GET: model online? (name + ctx for the status chip)
├── lib/
│   ├── components/                   ← Svelte components (Narration, HeroSheet, QuestLog, DiceTray, StatBlock…)
│   ├── server/
│   │   ├── db/                       ← drizzle schema.ts + client (better-sqlite3, WAL)
│   │   ├── llama.ts                  ← stream() + complete() + health(); timeouts; SSE parse
│   │   ├── engine/                   ← rules.ts (dice, mods, damage) · worldstate.ts (zod + apply) · memory.ts (tiers)
│   │   └── prompts/                  ← gm.md (GM system prompt, versioned) · worldbrief.md · hero.md · update-state.md
│   ├── stores/                       ← campaign session state ($state runes in .svelte.ts files)
│   └── ui/                           ← shadcn-svelte copies + theme
├── tests/                            ← *.test.ts next to units; *.svelte.test.ts for components · fake-llama/ stub
├── scripts/fetch-assets.mjs          ← re-download scene art from the committed manifest
└── static/
    └── assets/scenes/                ← scene-art image binaries (gitignored)
assets/manifest.json                  ← COMMITTED scene-art manifest {file, tags, setting, source, license, author}[]
data/gate.db                          ← SQLite file (gitignored)
```

## Key backend behaviors (learned the hard way in the sibling project)

1. **SSE proxying**: `+server.ts` returns a `ReadableStream` with `content-type: text/event-stream`. Send `Connection: close` semantics (close the upstream llama connection when the client aborts — check `request.signal`), else clients hang. Never buffer the whole stream.
2. **Stop mid-generation**: an in-flight `POST /api/gm/turn` must be abortable — `/api/gm/stop` sets a per-campaign flag polled per delta; the client ALSO aborts its fetch (`AbortController`). Server-side abort frees llama-server slots; client-only abort leaves the server writing into the OS socket buffer for seconds (Windows).
3. **Two call classes**: streaming for player-facing narration; short `complete()` (non-stream, temperature 0.2–0.4, JSON mode prompt + zod parse + **one retry feeding the parse error back**) for world brief, hero gen, state updates, recaps.
4. **max_tokens generosity**: Gemma thinking-mode can burn the whole budget on reasoning and return empty content. GM narration: 3,000+ tokens, reasoning off. State updates: reasoning off, compact JSON.

## Testing strategy

- **Unit (pure TS, no DOM)** — dice (seeded RNG → deterministic), stat mods, damage calc, XP thresholds, zod schema accept/reject, prompt builder (snapshot), world-state apply/reduce.
- **Component (@testing-library/svelte)** — HeroSheet renders state, QuestLog statuses, narration renderer splits dialogue/narration correctly, dice tray interactions.
- **Route handlers** — `vi.stubGlobal('fetch')` with canned OpenAI-shaped responses (incl. SSE chunks) → assert stream passthrough, stop-flag break, DB writes.
- **Fake llama server** (`tests/fake-llama/`) — a tiny Node http server speaking `/v1/chat/completions` + `/v1/models`, scriptable (slow stream, JSON-mode outputs, CJK-leak fixture). Used for manual + Playwright runs so we NEVER test against the user's live 8080.
- Coverage bar: `engine/` and `db/` at ~100% line coverage; components behavioral (queries + user events), not line-count theater.
- `npm run test` (Vest-style watch off in CI mode), `npm run test:ui` for the Vitest UI, `npm run check` = `svelte-check` + `tsc`.

## Conventions

- Component files PascalCase, one component per file; UI copy strings in Thai inline (extract to a `th.ts` lexicon if repetition grows).
- Server-only code stays under `lib/server/` — SvelteKit enforces the import boundary.
- Every DB migration via Drizzle Kit (`drizzle/` folder, SQL checked in). Never edit `gate.db` by hand while the dev server runs (WAL lock).
- All fetches to llama go through `lib/server/llama.ts` — no scattered URLs.
