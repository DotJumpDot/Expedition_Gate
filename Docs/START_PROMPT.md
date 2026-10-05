# Session start prompt — paste this into a fresh chat (workspace: C:\Code\Expedition_Gate)

---

You are working on **Expedition's Gate** — my single-player AI-GM adventure RPG at `C:\Code\Expedition_Gate`. This is a fresh session: you know nothing beyond this prompt and the project files. Follow these steps in order.

**Step 1 — load the full project context BEFORE anything else:**
1. Read `C:\Code\Expedition_Gate\AGENTS.md` — project rules, locked decisions, my machine's AI setup, hard boundaries.
2. Read ALL six files in `C:\Code\Expedition_Gate\Docs\`: `00_VISION.md`, `01_TECH_STACK.md`, `02_GAME_DESIGN.md`, `03_WORLD_STATE.md`, `04_GM_PROMPT.md`, `05_ROADMAP.md`.

Everything is already decided in those files (SvelteKit stack, 8 stats, content policy, scene art, choice chips, libraries, no-Zustand). Do NOT re-litigate decisions or propose alternatives unless I ask.

**Step 2 — load UX/UI/Animation skills BEFORE writing any UI (critical — UI quality is a top priority for me):**
Load these skills with the Skill tool first: `apple-design`, `emil-design-eng`, `animate`. For the animation/polish pass also load `animation-vocabulary` / `find-animation-opportunities` / `improve-animations` if available. Every screen must feel polished: press feedback, transitions, streaming text reveal, dice-roll animation, scene-card crossfade — all wrapped in `prefers-reduced-motion`, hover effects only under `@media (hover:hover) and (pointer:fine)`. Desktop-first layout.

**Step 3 — the mission:** start **Phase 0 (P0 scaffold)** exactly per the checklist in `Docs/05_ROADMAP.md`, then continue to P1. Respect each phase's definition of done; commit at every phase end (I ask for pushes myself, never push on your own).

**Standing rules** (full versions in AGENTS.md):
- Talk to me in **English**; ALL game UI and content strings are **Thai**.
- Never restart my model/app servers. Test against the fake-llama stub (`tests/fake-llama/` per Docs/01), NEVER my live port 8080.
- All SQL parameterized via Drizzle — never build SQL by string concatenation.
- **Vitest, NOT Jest.** No Zustand / TanStack Query. Don't add dependencies that aren't in `Docs/01_TECH_STACK.md` without asking me first.
- Absolute content boundary: no sexual content involving minors or school-coded settings — ever.
- The app does all dice/math server-side; the model only narrates resolved facts.
- If something is genuinely ambiguous, ask me before building it wrong.

Start now: read the files, reply with ONE short paragraph confirming what you're about to do, then begin P0.
