# AGENTS.md — Expedition's Gate

**Single-player AI-GM adventure RPG.** A D&D-style tabletop experience where the AI is the Game Master — narrator, referee, and every NPC — with unlimited directions for the story to go. Runs 100% locally against the user's own llama-server. Sibling project of `C:\Code\Novel's_Model` (same user, same machine, shared lessons).

> **This file + `Docs/` are the complete project context.** A fresh session should read this file first, then the Doc relevant to the task. The application code does **not exist yet** — Phase 0 scaffolds it (`Docs/05_ROADMAP.md`). Until then, this repo is design-only.

**Language rule: communicate with the user in ENGLISH only. All game UI and game content is THAI.**

## Decided — do not re-litigate

| Decision | Choice |
|---|---|
| Scope | **Single-player** (multiplayer is a future door only, see roadmap P5) |
| Layout | **Desktop-first** web app; responsive/mobile pass comes later (user plays this one mostly on PC) |
| Framework | **SvelteKit 2 + Svelte 5 (runes) + TypeScript** — backend routes + frontend in ONE project |
| Styling | Tailwind CSS + shadcn-svelte, dark-fantasy theme |
| Animation | svelte/transition (built-in) + **motion** (motion.dev — official Svelte support; Framer Motion is React-only) |
| Client state | **Svelte 5 runes** (`.svelte.ts` stores) — NO Zustand (React-coupled) / NO TanStack Query (localhost doesn't need a cache layer); forms via **Superforms**, GM stream via **@microsoft/fetch-event-source** |
| Database | **SQLite** via better-sqlite3 (WAL mode) + Drizzle ORM |
| Testing | **Vitest** + @testing-library/svelte + happy-dom (Jest-equivalent API — see `Docs/01_TECH_STACK.md` for why Jest was swapped) |
| AI backend | Local llama-server, OpenAI-compatible API. Default `http://127.0.0.1:8080/v1`, override via env `LLAMA_URL`. Never cloud. |
| Content rating | **Uncensored-mature-capable, flows with the story** — no per-campaign toggle. Full policy: `Docs/04_GM_PROMPT.md` § Content policy |
| Rules depth | **Hybrid**: EIGHT stats — RO six (STR/AGI/DEX/VIT/INT/LUK) + **SPI จิตวิญญาณ** + **CHA เสน่ห์** (8 = hard ceiling, more = world-state flags); HP + มานา pools, d20+mod vs DC, inventory/gold/quests. NOT full D&D 5e — user explicitly rejected that as fussy |
| Scene art | **Local free-asset library, AI-picked** (`world.sceneTag` from the manifest's controlled vocabulary) — **NOT ComfyUI at v1**: the GPU is busy running the GM during play; user explicitly deferred generation to a future door. CC0/free-license only, every asset recorded in `assets/manifest.json` |

## Golden rules

1. **English with the user. Thai only as game UI/content strings.**
2. **Local-only AI**: story content never leaves the machine. The only LLM endpoint is llama-server (`LLAMA_URL`).
3. **All SQL through Drizzle parameterized calls.** Never build SQL by string concatenation, `format`, or f-strings — inputs bind as parameters, always.
4. **Don't restart the user's model/app servers.** He runs them himself via `.bat` (gaming/benchmark RAM contention). Killing a confirmed stale duplicate listener is OK after HIS restart.
5. **The app does the math, the model tells the story.** Dice rolls, HP, damage, gold — computed server-side in TypeScript; the GM prompt receives already-resolved facts. The model never invents roll results. (Rationale + pipeline: `Docs/02_GAME_DESIGN.md`.)
6. Do the one thing asked. Park side-findings as end-of-turn one-liners.
7. **Asset license discipline**: only CC0 / public-domain / explicitly-free art, always recorded in `assets/manifest.json` (source URL + license + author). Any URL-fetching script must validate scheme http/https and reject localhost/loopback/private/reserved hosts, with a per-file size cap.

## Repo layout

The repo root is design + docs; **the entire app lives in `expedition_gate/`** (user decision 2026-10-06). Run all npm/vite/drizzle commands from inside `expedition_gate/`.

```
C:\Code\Expedition_Gate\
├── AGENTS.md                  ← this file (project context for AI agents)
├── README.md                  ← quickstart
├── .gitignore                 ← node / .svelte-kit / data/*.db / .env / scene-art binaries
├── Docs\
│   ├── 00_VISION.md           ← what the game is, pillars, inspirations
│   ├── 01_TECH_STACK.md       ← SvelteKit decision, full stack, project structure, testing
│   ├── 02_GAME_DESIGN.md      ← game loop, stats/dice/HP, hero creation, turn pipeline, scene art
│   ├── 03_WORLD_STATE.md      ← SQLite schema, world-state JSON, update pipeline, memory tiers
│   ├── 04_GM_PROMPT.md        ← GM system prompt architecture + content policy + prompt lessons
│   └── 05_ROADMAP.md          ← phases P0–P5 with definition-of-done
└── expedition_gate\           ← THE APP (SvelteKit — all code + tooling live here)
    ├── package.json · vite.config.ts · tsconfig.json · eslint.config · .prettierrc
    ├── src\
    │   ├── routes\            ← app shell, gate screen, /campaign/[id], api/ (+server.ts) routes
    │   └── lib\               ← components · server (db/llama/engine/prompts) · stores · ui
    ├── tests\                 ← *.test.ts units · fake-llama\ stub server
    ├── scripts\fetch-assets.mjs
    ├── drizzle\               ← checked-in migration SQL
    ├── assets\manifest.json   ← scene-art library manifest (COMMITTED; binaries re-download via scripts/fetch-assets.mjs)
    ├── static\assets\scenes\  ← scene-art image binaries (gitignored)
    └── data\gate.db           ← SQLite campaign data (gitignored)
```

## The user's local AI rig (context that matters)

- Windows 11 + Git Bash, **RTX 5060 8GB VRAM** — the hard constraint for model choice.
- Model roster (from the Novel's Model blind benchmark, 2026-08-23):
  - **Gemma4-26B-A4B-heretic Q4_K_S** — Thai knowledge + rule-keeping champion (B1 21/30, B2 8.2/10), ~18–26 tok/s. **Recommended default GM.**
  - **Qwen3.5-9B Q4_K_M** — fast (~57 tok/s), occasional CJK token leaks, weaker persona hold.
  - **Qwen3.5-4B Q6_K** — small thinking model for background tasks if ever needed.
- Known model gotchas (bit us in the sibling project — believe them):
  - **Gemma is a thinking model**: without reasoning off it can burn the ENTIRE max_tokens budget on `reasoning_content` and return EMPTY content (`finish_reason: length`). Keep max_tokens generous for narration (3,000+) and reasoning off for GM turns.
  - **Prompt bans lose to in-context examples.** Gemma kept copying banned formatting from history examples despite explicit rules. ALWAYS include few-shot examples in prompts, and prefer mechanical enforcement (filters, zod validation) over prompt-only rules.
  - **Occasional CJK leaks** ("挑战") in Qwen output → detect + auto-retry pattern from the sibling app.
  - Background (non-streaming) LLM calls: use a separate short-timeout helper; JSON outputs need strict prompting + one retry with the parse error fed back.

## Ports on this machine (don't collide)

3000 Novel's Model app · **8080 llama-server** · 8188 ComfyUI · 8189 Picture Studio · 3100 Code Editor · **Expedition's Gate dev server: 5173** (SvelteKit default).

## Working gotchas (Windows + this machine)

- **Thai text via `curl -d` gets mangled** by the console code page → write JSON payloads to a file, use `--data-binary @file`. Payload files for Python: `os.environ['TEMP']` (no `/tmp` for Windows Python).
- **SSE streaming responses must send `Connection: close`** and actually close, or clients hang forever.
- **Test against a fake-llama stub** (OpenAI-compatible mock server, see `Docs/01_TECH_STACK.md` § Testing), NOT the user's live 8080, unless he says otherwise.
- **Zombie servers on Windows**: closing a console window doesn't always kill children; a stale specific-IP binding beats a new wildcard one. Diagnose `netstat -ano | grep :PORT`, match PIDs via command line + start time, `taskkill //PID <pid> //F`.
- **Verify UI via DOM assertions** (Testing Library / Playwright getBoundingClientRect), not screenshots — vision tools have hallucinated elements on this machine before.
- The folder name is apostrophe-free (`Expedition_Gate`) — keep paths that way in scripts.
