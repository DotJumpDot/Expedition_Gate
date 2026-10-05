# 05 — Roadmap

Phases with a definition of done. Work in order; each phase ends committed with tests green. Scope discipline: phases P0–P2 are the "playable game" line — nothing before it is a demo, nothing after it is required for v1.

## P0 — Scaffold ⚙️

`npm create svelte` (SvelteKit 2, TS strict) → install Tailwind, shadcn-svelte, motion, better-sqlite3 + drizzle, zod, Vitest + @testing-library/svelte + happy-dom.

- [ ] App shell renders at `http://localhost:5173` with dark-fantasy theme tokens
- [ ] Drizzle schema (`campaigns/messages/checkpoints`) + migration + `db/client.ts` (WAL)
- [ ] `lib/server/llama.ts`: `stream()`, `complete()`, `health()` against `LLAMA_URL` env
- [ ] `/api/llama/health` wired to a status chip
- [ ] `tests/fake-llama/` stub server (scriptable SSE + JSON modes)
- [ ] Vitest runs with 1 real test of the dice/stat unit (proves the pipeline)
- [ ] `.gitignore`, ESLint + Prettier, `npm run check` clean

## P1 — The GM loop (playable prototype)

- [ ] World creation wizard (setting/tone → world brief via `complete()`, 🎲 regenerate)
- [ ] Hero creation (concept + class-lite → AI stat/kit proposal → tweak/accept)
- [ ] `POST /api/gm/turn`: input → mechanics resolve (dice/stats/damage server-side) → GM SSE stream → save
- [ ] Narration renderer (dialogue `ชื่อ : "…"` / narration / 📊 status blocks — adapt the sibling app's line-splitting rules; glue regexes must never cross newlines)
- [ ] World-state update pipeline + zod + retry + `stateStale` fallback (`03_WORLD_STATE.md`)
- [ ] Stop mid-turn (⏹ button → `/api/gm/stop` flag + client AbortController — both, Windows lesson)
- [ ] Quick actions (⚔️ 🔍 💬 🏃) + free text both work
- **Done when**: a full session of ~10 turns keeps HP/gold/inventory consistent and reads like a Thai novel.

## P2 — Campaign living

- [ ] Gate screen: campaign list with resume/delete
- [ ] Checkpoints (save/restore/auto-snapshot-first) + death → epilogue → new-hero-in-same-world flow
- [ ] Quest log + NPC list panels driven from world state
- [ ] Memory tiers: session summary (every 8 turns) + chronicle (every 20)
- [ ] Choice chips: N tappable player-action options after every GM turn — **count configurable 0–6 in settings (default 3, 0 = off)**, tap = send, free text always available; player-voice guard included (`04_GM_PROMPT.md` #8)
- [ ] Level-up flow (XP → stat points → sheet edit)
- **Done when**: closing the tab overnight and resuming feels seamless (recap card + coherent continuation).

## P3 — Feel & polish

- [ ] Motion pass: dice roll animation, damage shake, panel transitions, streaming text reveal (respect `prefers-reduced-motion` throughout)
- [ ] Responsive/mobile pass (rail → bottom tabs, phone-width testing like the sibling app)
- [ ] Playwright e2e on the fake llama (create world → 5 turns → checkpoint → restore)
- [ ] CJK auto-retry + ⚠ chip; connection-lost states
- [ ] Settings: model URL, narration length seg (สั้น/กลาง/ยาว), extras toggle (📊 on/off)

## P4 — Depth (post-v1, pick by interest)

- **Scene art v1 — free-asset library, no GPU** (decided 2026-10-06; ComfyUI deferred by user — GPU contention while the GM runs):
  - [ ] Curate `assets/manifest.json` (~80–120 images, ~25 tags, all four setting presets; CC0/free-license ONLY, each entry records source URL + license + author)
  - [ ] `scripts/fetch-assets.mjs` re-downloader (URL validation: http/https, host rejected if localhost/loopback/private/reserved; per-file size cap; atomic writes)
  - [ ] `sceneTag` in world state + tag vocabulary in the update-state prompt + zod fallback to previous
  - [ ] Scene card UI: tag match + setting filter + anti-repeat + motion crossfade + 🖼 manual override
- GM prompt runtime editor (like the sibling's style prompt editor)
- **Major-decision mode**: GM can flag a cliffhanger turn, and the chip call generates dramatic branch choices instead of generic next actions (sibling `/choices{}` lineage — app-generated, not model-formatted, per the mechanical-enforcement lesson)
- Sound design (dice, ambient per setting) — opt-in
- Campaign export/import (single `.json` file with messages + state)
- Bestiary / world wiki auto-built from `lore` + npcs

## P5 — Future doors (explicitly NOT promised)

- **Multiplayer** (the "MMO" door): friends join the same campaign via LAN — reference AnyWorld; SvelteKit server already centralizes state, but turn ownership + sync is a project of its own
- **ComfyUI-generated art** (hero portraits, bespoke scene images via his Picture_Model rig, port 8188) — **deferred at v1 by user decision**: the GPU is busy running the GM during play
- TTS narration (Thai voices — model quality TBD)
- Map view (the reserved right rail), party of multiple heroes
- English UI language toggle (Thai stays default)

## Standing test/verification rules (all phases)

- Never test against the live 8080 llama-server; use the fake stub (manual feel-tests with his Gemma are fine when HE offers)
- Never restart his servers; never bind a dev server to 0.0.0.0 without asking (LAN exposure)
- UI verification via DOM assertions, not screenshots
- Thai strings in payload files for curl (`--data-binary @file`)
- Commit at every phase end; he asks for pushes explicitly
