# Expedition's Gate

**Single-player AI-GM adventure RPG.** A D&D-style tabletop experience where the AI is the Game Master — narrator, referee, and every NPC — with unlimited directions for the story to go. Runs 100% locally against your own llama-server. All game content and UI is Thai; the repo is documented in English.

- Project context & rules: [`AGENTS.md`](AGENTS.md)
- Design docs: [`Docs/`](Docs/) — start with [`00_VISION.md`](Docs/00_VISION.md), roadmap in [`05_ROADMAP.md`](Docs/05_ROADMAP.md)

## Repo layout

The root is docs + design. **The entire app lives in [`expedition_gate/`](expedition_gate/)** — run everything from there:

```bash
cd expedition_gate
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest (unit + component)
npm run check      # svelte-check + tsc
```

The GM model is expected on llama-server at `http://127.0.0.1:8080/v1` (override with `LLAMA_URL` in `expedition_gate/.env`). For testing, use the fake-llama stub (`tests/fake-llama/`), never a live server.
