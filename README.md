# Expedition's Gate

**Single-player AI-GM adventure RPG.** A D&D-style tabletop experience where the AI is the Game Master — narrator, referee, and every NPC — with unlimited directions for the story to go. Type anything; the world reacts, remembers, and keeps the books. Runs **100% locally** against your own [llama-server](https://github.com/ggml-org/llama.cpp); nothing ever leaves your machine.

All game UI and game content is **Thai**; the repo is documented in English.

- Project context & rules for AI agents: [`AGENTS.md`](AGENTS.md)
- Design docs: [`Docs/`](Docs/) — vision [`00`](Docs/00_VISION.md) · stack [`01`](Docs/01_TECH_STACK.md) · game design [`02`](Docs/02_GAME_DESIGN.md) · world state [`03`](Docs/03_WORLD_STATE.md) · GM prompts [`04`](Docs/04_GM_PROMPT.md) · roadmap [`05`](Docs/05_ROADMAP.md)

## What's in the game (v1 — P0–P4 complete)

**Create** — two paths, both full pages (no pop-ups):

- **Main menu** — 5 hand-authored **ready-to-play scenarios** as rich picture cards (ผู้กลับชาติขุนนางแดนน้ำแข็ง · ไต่ชั้นสถาบันเวทมนตร์ · ระบบพลังลับ · ขุนนางตกอับ นักดาบพเนจร · ผู้สั่งการเวลา): scene art on the left of each card, full story/situation/hooks/named NPCs inside, pick a ready-made hero that fits (still tweakable) or build your own inside that story — play instantly, no generation wait. Scenario files live in `src/lib/game/scenarios.ts` and are edited like prompts.
- **สร้างโลกเอง** (`/adventures/new`) — 28 world presets grouped in the wizard (มันหวา · เกาหลี: ประตูมิติ & นักล่า, ผู้ย้อนเวลา, หอคอยไร้ยอด, มูริม, วิลเลนเนส, ตัวประกอบในนิยาย, จ้าวแห่งดันเจี้ยน… · แฟนตาซี · โลกสมัยใหม่ · ตะวันออก/อนาคต/สยองขวัญ). Each description steers the GM's world brief directly (editable, saveable as your own preset) + tone chips → AI writes the world brief → hero with 11 classes or a fully custom class (name + ability description); the AI proposes stats and kit, and the 52-point buy stays tweakable either way.
- **การผจญภัย** (header button) — every saved adventure on its own page.

**Themes** — ตั้งค่า → การแสดงผล → ธีมสี: มืดแฟนตาซี (default) · สว่างกระดาษ · Monokai Soda · Monokai Night · ซากุระ สว่าง · ซากุระ มืด — every surface, chip, and game color follows via CSS custom properties.

**Play** — free-text input always available, plus quick actions (⚔️ โจมตี · 🔍 ตรวจสอบ · 💬 พูดคุย · 🏃 หนี) and a dice tray (pick stat + DC). **The app does all the math server-side** — d20+mod vs DC, weapon damage, crits, HP/MP/gold/XP, declared-spell มานา costs (tiered 3/5/8, fizzles when short), and potion use (ใช้ button on recognized items — heal 2d6+4 / มานา 1d6+7) — and the GM narrates the already-resolved result as streaming Thai novel prose (dialogue lines, 📊 status blocks only when something mechanical changed). Botched a roll? Spend 1 แต้มดวง (LUK) to reroll the last check with fate twisting back. At 0 HP the dying hero rolls death saves (d20 ≥ 10, three fails = the end).

**Live world** — hero sheet, quest log, and NPC panel update every turn from a zod-validated world state; scene art card illustrates the current scene from a 37-image local library (AI-picked `sceneTag`, anti-repeat, manual 🖼 override); บันทึกแห่งโลก codex collects lore, NPCs, quests, flags.

**Hero portraits** — every hero gets a face from a locally-generated anime library (ComfyUI, `npm run portraits`): 72 hero portraits (6 ages × 6 roles × 2 checkpoints) plus personality variants (cheerful / stern / dull), NPC professions (innkeeper, guard, blacksmith, servant, farmer, priest — men and women), and a monster bestiary (goblin, orc, slime, dragon, skeleton, ghost, wolf, bandit, troll, kobold, golem, harpy) — 192 images total. Auto-picked to fit the hero's class / the NPC's role (Thai keyword matching, monsters included) and stable per name, with a manual 🖼 override on the game screen; NPC faces show in the NPC panel. (A photorealistic bucket was generated and dropped by review — it didn't match the app's look.)

**Memory** — three tiers injected into every GM prompt: verbatim window, session summary (rebuilt every 8 turns), and a whole-campaign chronicle (every 20). Closing the tab overnight and resuming gives you a "ก่อนหน้านี้…" recap and coherent continuation.

**Control** — stop mid-turn (⏹ — server flag + client abort), checkpoints (30-cap; restoring archives the abandoned branch, nothing is ever lost), choice chips (0–6 configurable next-action suggestions, ✨-labeled on major-decision cliffhangers), level-ups (2 stat points), death → AI epilogue → rebirth as a new hero in the same world, campaign export/import as a single `.json`.

**Tuning** — a full `/settings` page (section nav + cards): reading font (Sarabun / IBM Plex Sans Thai / Mitr bundled, or system fonts) + UI text scale, hero-panel side (left/right), narration length (สั้น/กลาง/ยาว), 📊 extras on/off, chip count, GM model URL, and a runtime GM-prompt override appended as the last instruction (last-instruction-wins).

Also in place: CJK-leak auto-retry with ⚠ chip, stale-state chip when a state update fails, connection-lost handling, `prefers-reduced-motion` everywhere, mobile pass (rail → tabs), dark-fantasy theme. Readability pass (2026-10-06 late): per-speaker colored dialogue cards, `**bold**`/`*stage-direction*` inline rendering, per-value colorized 📊 status chips, player-friendly dice wording, collapsible hero-panel sections, follow-scroll only while you're at the bottom.

## Quickstart

Requirements: Node 20+, an OpenAI-compatible llama-server (default `http://127.0.0.1:8080/v1`).

```bash
cd expedition_gate
npm install
npm run assets    # download the scene-art library from assets/manifest.json
npm run dev       # → http://localhost:5173
```

Optional `expedition_gate/.env` (never committed):

```
LLAMA_URL=http://127.0.0.1:8080/v1
```

No llama-server handy? Play against the stub instead — it speaks the same API:

```bash
npm run fake-llama          # stub on :8090
LLAMA_URL=http://127.0.0.1:8090/v1 npm run dev
```

## Testing

All from `expedition_gate/`; nothing ever touches a live model server:

```bash
npm test         # Vitest — 120 unit/engine tests (15 files)
npm run e2e      # node E2E smoke vs fake-llama: wizard → turns → stop → persist →
                 #   chips cache → checkpoint round-trip → consolidation → cleanup
npm run e2e:pw   # Playwright browser e2e (boots fake-llama + dev server itself)
npm run check    # svelte-check + tsc
npm run lint     # prettier --check + eslint
```

The stub (`tests/fake-llama/`) routes scenarios per request via `model: 'fake:<name>'` (`ok` `json` `hero` `state` `cjk` `reasoning-burn` `slow` `empty` …) or by prompt content, so full play flows work without a GPU.

## Project layout

Root is docs + design only; **the entire app lives in [`expedition_gate/`](expedition_gate/)**:

```
expedition_gate/
├── src/routes/            app shell · gate screen · /campaign/[id] · api/ server routes
│   └── api/               campaigns (brief, hero-proposal, checkpoints, restore,
│                          level-up, epilogue, rebirth, export, import, delete)
│                          gm (turn SSE, stop, suggestions) · llama/health · scenes
├── src/lib/game/          isomorphic rules + world-state zod (client-safe)
├── src/lib/server/        db (Drizzle schema + client) · llama.ts client · engine
│                          (turn, campaigns, memory, gm, turnRuntime) · prompts/*.md
├── src/lib/components/    game UI (narration, hero sheet, scene card, chips, …)
│                          + shadcn-svelte ui/ copies
├── src/lib/stores/        Svelte 5 runes session stores (campaign, settings)
├── tests/                 engine/db units · fake-llama/ stub · e2e-smoke.mjs · e2e/
├── scripts/fetch-assets.mjs
├── assets/manifest.json   scene-art manifest (committed; binaries re-download)
├── static/assets/scenes/  scene-art images (gitignored)
└── data/gate.db           SQLite campaign data (gitignored)
```

## Assets & licensing

Scene art is **CC0 / public-domain / explicitly-free-license only**. Every image is recorded in `expedition_gate/assets/manifest.json` with source URL, license, and author; `npm run assets` re-downloads binaries after a fresh clone (URLs validated — no private/loopback hosts, per-file size cap). The committed library currently holds **37 images**: 13 locally-authored CC0 SVG scenes plus 24 curated from Wikimedia Commons (public-domain Romantic paintings for the fantasy/horror moods, PD Ayutthaya photography for ตำนานไทย, NASA/ESA/Webb imagery for ไซไฟ, and CC-BY/CC-BY-SA works with recorded attribution). Growing it to the planned 80–120 is an ongoing content task — append verified `url` entries to the manifest and re-run the script (see `Docs/02` § Scene illustration).

## Status

P0–P4 of the [roadmap](Docs/05_ROADMAP.md) are complete, independently re-audited (12 fixes), and pushed. Deliberately open: sound design (needs audio assets), real scene-art curation, and a real-model playtest with Gemma. P5 (multiplayer, ComfyUI art, TTS, map view) is a list of future doors, not promises.
