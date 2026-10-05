# Expedition's Gate — the app

SvelteKit + Svelte 5 (runes) + TypeScript strict. All game code, UI, and tooling for the single-player AI-GM adventure RPG. Project context lives one level up (`../AGENTS.md`, `../Docs/`).

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # Vitest (rules, db, llama client vs fake stub)
npm run check        # svelte-check
npm run lint         # prettier --check + eslint
npm run fake-llama   # OpenAI-compatible stub on :8090 (use this, NOT live :8080)
npm run db:generate  # drizzle-kit migrations → drizzle/ (checked in)
```

- GM endpoint: llama-server at `http://127.0.0.1:8080/v1`, override via `LLAMA_URL` in `.env` (declared in `src/env.ts`, read via `$app/env/private`).
- Database: `data/gate.db` (SQLite + WAL, gitignored). Migrations auto-apply at startup.
- The browser never talks to llama-server directly — everything goes through SvelteKit server routes under `src/routes/api/`.
