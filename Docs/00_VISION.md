# 00 — Vision

**Expedition's Gate** (โปรเจกต์: เกทนักสำรวจ) — a single-player adventure RPG where the AI is your Game Master.

You step through the gate. The AI narrates the world, plays every NPC, referees every roll, and reacts to *anything* you try — no fixed plot, no scripted branches that run out. It's the tabletop D&D experience without needing five friends and a schedule, and it runs entirely on your own machine.

## Design pillars

1. **The AI is the GM, not a chatbot.** Three jobs in one: **narrator** (novel-quality Thai prose), **referee** (honors dice and stats — enforced by the app, not the model's honesty), and **cast** (every NPC with their own voice and agenda). It never railroads; the world responds to what the player actually does.
2. **Unlimited direction.** "MMO-feel" in a single-player game: the player can attempt anything, and the world keeps reacting. Consequences persist — NPCs remember, quests fail, the world clock moves.
3. **Thai-native.** All narration, dialogue, and UI in natural Thai — modern spoken dialogue in quotes, novel-grade narration, no translationese. (Voice-quality rules carried from the sibling project; see `04_GM_PROMPT.md`.)
4. **Content follows the player's lead.** The game is uncensored-mature-capable: blood, violence, sex, dark themes all allowed — but they *flow from the story and the player's actions*. Never forced in, never sanitized out. Hard limits are absolute (see content policy in `04_GM_PROMPT.md`).
5. **100% local.** llama-server on the user's GPU, SQLite on disk, no cloud calls, no accounts. If the internet dies mid-campaign, nothing changes.

## The experience loop

```
Create a world  →  choose setting + tone, AI generates the world brief + opening scene
Create a hero   →  name, concept, class-lite; eight stats (STR/AGI/DEX/VIT/INT/SPI/CHA/LUK), AI allocates or you do
Play            →  type anything / pick quick actions (⚔️ 🔍 💬 🏃) / roll dice
                  → app resolves the mechanics server-side
                  → GM narrates the outcome + world reaction + NPC dialogue
                  → status panel & quest log update from the world state
Save & resume   →  campaign autosaves every turn; checkpoints anytime; "ก่อนหน้านี้…" recap on return
```

## What it is NOT (v1)

- **Not multiplayer.** True "MMO" (friends in the same world) is a future door (`05_ROADMAP.md` P5, reference: AnyWorld). v1 is one player + one GM.
- **Not a full D&D 5e rules engine.** No classes/spell-slot grids/initiative trackers — the user explicitly rejected that as "too fussy". Eight stats + HP/มานา + dice + inventory is the whole mechanical surface.
- **Not a chat client.** No generic AI chat UI. Every screen serves the campaign: world brief, hero sheet, narration, dice, quests.
- **Not cloud-connected.** Ever, by design.

## Inspirations (studied, not forked)

| Project | What we took from it |
|---|---|
| [Talemate](https://github.com/vegu-ai/talemate) | Multi-agent GM architecture: narrator / world-state / summarizer as separate concerns; world state as first-class data |
| [SillyTavern](https://github.com/SillyTavern/SillyTavern) + [Multihog DnD Framework](https://github.com/MultihogAurelius/SillyTavern-MultihogDnDFramework) | Lorebook/world-info injection; running structured D&D on top of an RP frontend |
| AI Dungeon (closed source) | The core promise: type anything, world adapts — and the cautionary tale of losing coherence over long play (solved here via app-owned state) |
| [AnyWorld](https://github.com/iamarxs/AnyWorld) | Proof that multiplayer + AI DM + local LLM works — the P5 reference |
| The user's own Novel's Model | Everything: SSE streaming patterns, memory tiers, checkpoint UX, Thai prose rules, model gotchas |

## Place in the user's ecosystem

Expedition's Gate is a sibling of `Novel's_Model` (character novel-RP) and `Picture_Model` (local image gen + Picture Studio UI). Future integration doors, not v1 promises: campaign export, TTS narration.

**Scene art is deliberately NOT ComfyUI-generated** (decided 2026-10-06): the GPU is busy running the GM during play — image generation on top would contend for VRAM. v1 illustrates scenes from a curated local library of free-to-use art that the AI picks from per scene ("we're in an inn" → inn picture). ComfyUI-generated art stays a future door for when the user wants it (see `02_GAME_DESIGN.md` § Scene illustration, `05_ROADMAP.md` P5).

The app name is written **Expedition's Gate**; the repo/folder is `Expedition_Gate` (apostrophe-free on purpose — paths with `'` broke tooling on Windows before).
