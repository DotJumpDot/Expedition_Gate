# Session start prompt — paste this into a fresh chat (workspace: C:\Code\Expedition_Gate)

---

You are working on **Expedition's Gate** — my single-player AI-GM adventure RPG at `C:\Code\Expedition_Gate`. This is a fresh session: you know nothing beyond this prompt and the project files. Follow these steps in order.

**Step 1 — load the full project context BEFORE anything else:**
1. Read `C:\Code\Expedition_Gate\AGENTS.md` — project rules, locked decisions, current status, my machine's AI setup, hard boundaries.
2. Read the Doc relevant to today's task in `C:\Code\Expedition_Gate\Docs\`: `00_VISION.md`, `01_TECH_STACK.md`, `02_GAME_DESIGN.md`, `03_WORLD_STATE.md`, `04_GM_PROMPT.md`, `05_ROADMAP.md`.

Everything is already decided in those files (SvelteKit stack, 8 stats, content policy, scene art, choice chips, libraries, no-Zustand). The app is COMPLETE through P4 and audited — do NOT re-litigate decisions, rebuild what exists, or start P5 (future doors) unless I explicitly ask.

**Step 2 — if the task touches UI, load UX/UI/Animation skills BEFORE writing any markup (critical — UI quality is a top priority for me):**
Load these skills with the Skill tool first: `apple-design`, `emil-design-eng`, `animate`. Every screen must stay polished: press feedback, transitions, streaming text reveal, dice-roll animation, scene-card crossfade — all wrapped in `prefers-reduced-motion`, hover effects only under `@media (hover:hover) and (pointer:fine)`. Desktop-first layout. Verify UI via DOM assertions, never screenshots.

**Step 3 — the mission:** I'll tell you what to work on. Likely candidates right now: fixes/polish from my real-Gemma playtest, scene-art curation (80–120 free-license images into `assets/manifest.json`), sound design (opt-in, needs audio assets), or the LUK spend-reroll and spell-cost refinements noted in `Docs/02_GAME_DESIGN.md`. Run the full verification set before calling anything done: `npm test`, `npm run check`, `npm run lint` (all from `expedition_gate/`), plus `npm run e2e` / `npm run e2e:pw` when behavior changed.

**Standing rules** (full versions in AGENTS.md):
- Talk to me in **English**; ALL game UI and content strings are **Thai**.
- Never restart my model/app servers. Test against the fake-llama stub (`npm run fake-llama`, port 8090), NEVER my live port 8080.
- All SQL parameterized via Drizzle — never build SQL by string concatenation.
- **Vitest, NOT Jest.** No Zustand / TanStack Query / Superforms. Don't add dependencies that aren't in `Docs/01_TECH_STACK.md` without asking me first.
- The app does all dice/math server-side; the model only narrates resolved facts.
- Commit at phase/task boundaries; I ask for pushes myself, never push on your own.
- If something is genuinely ambiguous, ask me before building it wrong.

Start now: read the files, reply with ONE short paragraph confirming what you're about to do, then begin the task I give you.
