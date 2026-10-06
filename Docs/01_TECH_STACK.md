# 01 — Tech Stack

## Why SvelteKit (and not Next.js / Astro)

The user's requirement: one framework handling **backend + frontend together**, a real UI/animation library (no hand-rolled single-file HTML), SQLite, and Jest-class testing. He flagged Next.js as feeling "heavy and slow" and floated SvelteKit or Astro.

- **SvelteKit 2** — chosen. One project: Svelte components for UI, `+page.server.ts` / `+server.ts` routes for the backend, Vite under the hood (fast dev server, instant HMR). Ships the *smallest* runtime of the big three — a local game wants snappy, not heavy. Transitions are a first-class language feature. (**Reality:** `sv create` at P0 installed **SvelteKit 3 / Svelte 5.57 / Vite 8 (rolldown/oxc) / TS 6** — the current generation of the same decided stack; Kit-3 specifics live in `AGENTS.md` § Working gotchas.)
- **Next.js (React)** — rejected. Heavier dev experience, React's runtime + hydration cost buys nothing for a single-player local app, and its Jest-era testing story is exactly the "old and heavy" feeling he reacted against.
- **Astro** — rejected. Content-site oriented (blogs, docs, marketing). A constantly-interactive game UI would end up as Svelte islands inside Astro scaffolding — paying for a framework that isn't doing the work.

**The Jest → Vitest swap (be able to explain this):** Jest is React-ecosystem-bound; its Svelte adapter (svelte-jester) is stale for Svelte 5 runes. **Vitest is the Svelte-native standard with the same API** (`describe / it / expect`, mocks, snapshots, coverage), Vite-powered so it shares SvelteKit's pipeline. The user asked for "Jest testing" meaning that *class* of testing — Vitest delivers it. Do not install Jest.

## The stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **SvelteKit 3 (the "SvelteKit 2" decision — see reality note above), Svelte 5 (runes)** | `$state / $derived / $effect` — no stores needed |
| Language | **TypeScript, strict** | No `any` in domain code |
| Styling | **Tailwind CSS v4** | `@theme` oklch tokens, dark-fantasy theme |
| UI kit | **shadcn-svelte** (bits-ui) | button, card, input, popover, progress, separator, badge — owns a11y; copy-in components we theme |
| Animation | **svelte/transition + CSS keyframes** | Carried ALL v1 polish (dice tumble, shake, streaming reveal, crossfades), always behind `prefers-reduced-motion`; hover only under `@media (hover:hover) and (pointer:fine)`. **motion** (motion.dev) installed but unused — spring/physics door stays open |
| Forms | **plain `fetch` + zod** | Superforms was the plan, dropped at P0: every form is a JS-driven dialog (wizard, settings, checkpoints) — no progressive-enhancement requirement. zod validates API bodies server-side |
| SSE client | **@microsoft/fetch-event-source** | browser-side SSE over POST with abort — native EventSource can't POST; used for the GM turn stream (its `FatalError` isn't exported → local class) |
| Icons | **@lucide/svelte** | UI chrome icons (deep-imported, 9 icons pre-warmed in `optimizeDeps`); in-game action icons stay emoji |
| Database | **better-sqlite3** (WAL) + **Drizzle ORM** | Sync driver is fine for single-user; Drizzle = typed schema + **parameterized queries only** |
| Validation | **zod v4** | World-state JSON, API bodies, LLM JSON outputs |
| AI client | hand-rolled `fetch` wrapper (`lib/server/llama.ts`) | OpenAI-compatible `/v1/chat/completions`; `stream()` / `complete()` / `health()` with explicit `baseUrl` override for tests + `resolveLlamaBaseUrl` local-only allowlist; **the browser never talks to llama-server directly** |
| Testing | **Vitest** + **@testing-library/svelte** + happy-dom + **Playwright** | Unit + component + route handlers; Playwright browser e2e since P3 |
| Env | `src/env.ts` → `LLAMA_URL` (default `http://127.0.0.1:8080/v1`) | Kit 3 pattern (`defineEnvVars` + `$app/env/private`); never commit `.env` |

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

## Project structure (as shipped, P0–P4)

The app lives in `expedition_gate/` at the repo root (user decision 2026-10-06 — root keeps only `AGENTS.md`, `README.md`, `Docs/`). All paths below are relative to `expedition_gate/`.

```
src/
├── env.ts                            ← LLAMA_URL via defineEnvVars (Kit 3 env pattern)
├── routes/
│   ├── +layout.svelte                ← app shell (campaign list / campaign view switch)
│   ├── +page.svelte / +page.server.ts← Gate screen: campaign list + import + สร้างโลกใหม่ wizard
│   ├── campaign/[id]/+page.*         ← the game screen (load + three-zone layout)
│   └── api/
│       ├── campaigns/+server.ts      ← POST create · GET list
│       ├── campaigns/[id]/+server.ts ← GET one · DELETE
│       │   └── …/checkpoints/…       ← GET list · POST create · POST restore (archives branch)
│       │   └── …/level-up · epilogue · rebirth · export
│       ├── campaigns/brief · hero-proposal · import
│       ├── gm/turn/+server.ts        ← POST: input → mechanics → GM SSE stream → save
│       ├── gm/stop/+server.ts        ← POST: per-campaign stop flag (polled per delta)
│       ├── gm/suggestions/+server.ts ← POST: choice chips (major-decision aware)
│       ├── llama/health/+server.ts   ← GET: model online? (status chip)
│       └── scenes/+server.ts         ← GET: scene-art manifest, availability-flagged
├── lib/
│   ├── game/                         ← ISOMORPHIC (client+server): rules.ts (stats, DC table,
│   │                                   dice, damage, XP) · worldstate.ts (WorldStateSchema,
│   │                                   SETTING_PRESETS, death saves) — Kit 3 forbids client
│   │                                   value imports from $lib/server/**, hence this module
│   ├── narration.ts                  ← dialogue `ชื่อ : "…"` / narration / 📊 parser
│   ├── components/
│   │   ├── GmStatusChip · WorldWizard
│   │   └── game/                     ← NarrationCard · HeroSheet · SceneCard · QuestList ·
│   │                                   NpcPanel · ChoiceChips · CommandBar (quick actions +
│   │                                   dice tray) · CheckpointManager · LevelUpModal ·
│   │                                   DeathOverlay · RecapCard · WorldCodex
│   ├── server/
│   │   ├── db/                       ← schema.ts (campaigns/messages/checkpoints) + client.ts
│   │   ├── llama.ts                  ← stream()/complete()/health() + local-only URL allowlist
│   │   ├── engine/                   ← turn.ts (resolveTurn) · campaigns.ts (CRUD/checkpoints/
│   │   │                                export/import/rebirth/consolidation cadence) · memory.ts
│   │   │                                (window + summary/chronicle assembly) · gm.ts (prompt
│   │   │                                builders + one-retry JSON) · turnRuntime.ts (double-turn
│   │   │                                + stop flags) · rules.ts/worldstate.ts (server shims)
│   │   └── prompts/                  ← gm · worldbrief · hero · update-state · suggestions ·
│   │                                   session-summary · chronicle · epilogue (.md, versioned)
│   ├── stores/                       ← campaign.svelte.ts · settings.svelte.ts (localStorage)
│   └── ui/                           ← shadcn-svelte copies + theme
tests/
├── engine/                           ← rules · worldstate · turn · narration · gm-pipeline ·
│                                      memory · suggestions · campaigns-p2 · export-import ·
│                                      fetch-assets · recheck (audit regression tests)
├── db/client.test.ts
├── fake-llama/                       ← stub server (server.mjs) + its own tests
├── e2e-smoke.mjs                     ← node full-stack E2E vs the stub
└── e2e/                              ← Playwright spec + config (boots stub + dev itself)
scripts/fetch-assets.mjs              ← re-download scene art from the committed manifest
assets/manifest.json                  ← COMMITTED scene-art manifest {file, tags, setting, source, license, author}[]
static/assets/scenes/                 ← scene-art image binaries (gitignored)
data/gate.db                          ← SQLite file (gitignored)
```

## Key backend behaviors (learned the hard way in the sibling project)

1. **SSE proxying**: `+server.ts` returns a `ReadableStream` with `content-type: text/event-stream`. Send `Connection: close` semantics (close the upstream llama connection when the client aborts — check `request.signal`), else clients hang. Never buffer the whole stream.
2. **Stop mid-generation**: an in-flight `POST /api/gm/turn` must be abortable — `/api/gm/stop` sets a per-campaign flag polled per delta; the client ALSO aborts its fetch (`AbortController`). Server-side abort frees llama-server slots; client-only abort leaves the server writing into the OS socket buffer for seconds (Windows).
3. **Two call classes**: streaming for player-facing narration; short `complete()` (non-stream, temperature 0.2–0.4, JSON mode prompt + zod parse + **one retry feeding the parse error back**) for world brief, hero gen, state updates, recaps.
4. **max_tokens generosity**: Gemma thinking-mode can burn the whole budget on reasoning and return empty content. GM narration: 3,000+ tokens, reasoning off. State updates: reasoning off, compact JSON.

## Testing strategy (as shipped)

**86 unit tests across 13 files, all green at P4 close** — plus a node E2E smoke and 2 Playwright specs. Everything runs against the fake stub, never a live model.

- **Engine units** (`tests/engine/`) — seeded-RNG dice determinism, stat mods, damage/DR, XP thresholds, death saves, world-state zod accept/reject + serialization caps, turn resolution (attack/crit/quick-action DCs), narration parser (dialogue split never crosses newlines), GM pipeline (prompt assembly, loose JSON parse, one-retry, suggestion voice guard), memory tiers + consolidation cadence, campaign CRUD/checkpoint round-trip (branch archive), export/import round-trip, fetch-assets URL guards, and `recheck.test.ts` (regression tests from the 2026-10-06 audit).
- **Component tests** (`@testing-library/svelte` + happy-dom in `tests/setup.ts`) — behavioral DOM assertions, never screenshots (vision tools hallucinated elements on this machine before).
- **fake-llama stub** (`tests/fake-llama/server.mjs`, port 8090) — a tiny Node server speaking `/v1/chat/completions` + `/v1/models`. Scenarios per request via `model: 'fake:<name>'` (`ok` `json` `hero` `state` `cjk` `reasoning-burn` `slow` `empty`) or server-wide via `GET /__scenario/<name>`; non-stream JSON calls also route by prompt content (world-brief/hero/state-tracker/suggestions/summary/epilogue prompts get their fixture automatically). Happy-dom's `fetch` can't hit real sockets → server-side tests that talk to the stub use `// @vitest-environment node`.
- **Full-stack E2E** — `npm run fake-llama` + `LLAMA_URL=http://127.0.0.1:8090/v1 npm run dev` + `npm run e2e` (node smoke: wizard → opening → attack → stop-mid-turn → persistence → chips cache → checkpoint round-trip → 8-turn consolidation → cleanup). `npm run e2e:pw` boots the stub + dev server itself (Playwright `webServers`, isolated `gate.e2e.db`) and drives the real browser: create world → turns → checkpoint → restore.
- Commands: `npm test` · `npm run test:watch` · `npm run test:ui` · `npm run e2e` · `npm run e2e:pw` · `npm run check` (svelte-check) · `npm run lint` (prettier + eslint).
- Coverage bar: `engine/` behavioral-complete by scenario; components by interaction, not line-count theater.

## Conventions

- Component files PascalCase, one component per file; UI copy strings in Thai inline (extract to a `th.ts` lexicon if repetition grows).
- Server-only code stays under `lib/server/` — SvelteKit enforces the import boundary.
- Every DB migration via Drizzle Kit (`drizzle/` folder, SQL checked in). Never edit `gate.db` by hand while the dev server runs (WAL lock).
- All fetches to llama go through `lib/server/llama.ts` — no scattered URLs.
