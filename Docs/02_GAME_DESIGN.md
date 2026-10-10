# 02 — Game Design

The complete mechanical surface. Deliberately small — the depth comes from the AI's narration and world reaction, not from rules. Everything mechanical here is **computed by the app in TypeScript**; the model receives resolved facts and narrates them (anti-hallucination rule, see AGENTS.md #6).

## The eight stats (RO-style core + two narrative stats — decided 2026-10-06)

The RO six stays (instantly familiar to Thai players), plus **SPI จิตวิญญาณ** and **CHA เสน่ห์** — in an AI-GM game the two most common check families are *social* (persuade/seduce/deceive/haggle) and *perception/instinct/spirit-sense*, and both were homeless in the pure RO set. **Eight is the hard ceiling** — anything further (karma, reputation, corruption) is a world-state flag, not a stat.

| Stat | Thai | Governs |
|---|---|---|
| STR | พลัง | Melee damage, force feats (break doors, lift, grapple) |
| AGI | ความว่องไว | Dodge, initiative, running, hiding |
| DEX | ความแม่นยำ | Ranged accuracy, lockpicking, crafting, sleight of hand |
| VIT | พลังชีวิต | HP pool, resisting poison/disease, endurance |
| INT | สติปัญญา | Lore/knowledge, analysis, arcane spell checks, มานา pool |
| SPI | จิตวิญญาณ | Perception/instinct, spirit & magic sense (หมอผี territory), resisting mental influence, faith |
| CHA | เสน่ห์ | Persuade, seduce, deceive, intimidate, haggle, perform, lead |
| LUK | ดวง | Rare fate checks, crit range, loot luck, "แต้มดวง" reroll points |

Hero-sheet display grouping: **กาย** (STR·AGI·DEX·VIT) / **จิต** (INT·SPI·CHA) / **ชะตา** (LUK).

- **Range 1–10 at creation** (point-buy: **52 points**, min 1 each — or let the AI allocate from the hero concept).
- **Check modifier by stat value:** 1–2 → −2 · 3–4 → −1 · 5–6 → 0 · 7–8 → +1 · 9–10 → +2.
- **HP** = 20 + VIT × 4. **มานา (MP)** = 8 + (INT + SPI) × 2 — both mind stats feed the pool so spirit-caster heroes aren't INT-walled.
- **Spell costs**: minor flavor magic = narration only; a declared spell/ability costs มานา 3–10 by tier (the app deducts, never the model). *(Wired 2026-10-06: free text containing a cast verb (ร่าย/เสก/ใช้เวท…) is priced by intensity words — เวทเล็ก 3 · เวทปกติ 5 · เวทใหญ่ 8 — deducted app-side; not enough มานา = the cast fizzles with a resolution line, no deduction. Heuristics live in `lib/game/rules.ts`, isomorphic.)*
- AGI vs DEX overlap was debated (merge considered) — kept separate for RO identity; if GM playtests show the model constantly picking the wrong one of the pair, merge them then, not before. *(v1: quick actions hard-pin the stat — attack → weapon stat, search → SPI, talk → CHA, flee → AGI — so the model never picks.)*
- **Damage reduction** from armor: cloth 0 · leather 1 · chain 2 · plate 3 (+shield 1). Flat, no dice.
- **Leveling**: XP thresholds double per level (L1→2 = 100 XP); +2 stat points per level, +HP(VIT×2) +MP(INT×2). Soft cap L10 in v1 (numbers tunable later).

## Dice (the app rolls, never the model)

- **Core check**: `d20 + stat mod` vs **DC** — 8 ง่ายมาก · 12 ง่าย · 15 ปกติ · 18 ยาก · 22 แทบเป็นไปไม่ได้.
- **Nat 20** = critical success (narrated big). **Nat 1** = fumble (complication, never instant death).
- **Damage dice** by weapon: มีด d4 · ดาบ/กระบอง d6 · ขวาน/คทา d8 · อาวุธใหญ่ d10 · ธนู d6 (DEX), +STR mod on melee.
- **LUK**: `แต้มดวง` = LUK value, refresh each session; spend 1 to reroll any die or force "เป็นไปได้" on one declared action. *(Wired 2026-10-06: a gold 🎲 button under the last completed turn's narration spends 1 point and rerolls that check as its own GM turn ("โชคพลิกกลับมา") — offered only for the most recent check, while points last. Death saves and damage rolls are excluded. Session-refresh of the pool is still future work.)*
- **Opposed checks**: both sides roll d20+mod, high wins (NPC mods improvised by GM from fiction: ทหารเก่า ≈ 7, ปรมาจารย์ ≈ 10).
- Server-side RNG, results logged in the message record. **How the model learns the result**: the turn's context includes a line like `ผลการตัดสิน (ระบบทอยแล้ว ใช้ผลนี้เท่านั้น): d20(14) + DEX(+1) = 15 vs DC 15 → สำเร็จ` — the GM narrates the outcome, never re-rolls, never contradicts it.

## Combat (lightweight, narrative-first)

- Initiative = AGI check at combat start; order held until combat ends. *(v1: initiative lives in GM narration, not app math — no order tracker.)*
- A turn = one action + one move, narrated cinematically. No grid, no miniatures — theater of the mind.
- Enemies are brief stat lines the GM invents within the world state (`npcs[]`): e.g. `โจรป่า — HP 12, ดาบ d6, โดด ≈ AGI6`.
- Hero at 0 HP = **dying** (death saves: d20 ≥ 10 to stabilize, 3 ครั้ง). Actual permadeath = campaign ends → epilogue → "ประตูบานใหม่" (new run in the same world, world state persists). Roguelite-friendly without being punishing.

## World creation (สร้างโลกใหม่)

1. **Setting** — 28 built-in presets (worldstate.ts `SETTING_PRESETS`, wizard grid grouped via `PRESET_GROUPS`): มังฮวา · เกาหลี (ประตูมิติ & ฮันเตอร์, ผู้ย้อนเวลากลับมา, หอคอยไร้ยอด, มูริม, วายร้ายก่อนประหาร, ตัวประกอบในนิยาย, กลับชาติเป็นมอนสเตอร์, จ้าวแห่งดันเจี้ยน) · แฟนตาซี (ดาบและเวทมนตร์, สถาบันเวทมนตร์, ขุนนางแดนน้ำแข็ง, ขุนนางตกอับ, ราชสำนักตะวันออก, จอมมาร, โจรสลัด, เนโครแมนเซอร์, สังเวียนเลือด, ลูกครึ่งเทพ) · โลกสมัยใหม่ (ระบบพลังลับ, ผู้สั่งการเวลา, ซอมบี้ถล่มเมือง, มือปราบวิญญาณ) · ตะวันออก/อนาคต/สยองขวัญ (บู๊ลิ้ม, ตำนานไทย, จักรกลไอน้ำ, หลังวันสิ้นโลก, ไซไฟ, สยองขวัญ) · กำหนดเอง (free-text premise). Each preset's description paragraph **is the premise** the GM receives for the world brief (a player's edited text wins; ≤ 400 chars, enforced by tests).
2. **Tone** — มืดมน · ผจญภัย · ตลกฮา · โรแมนติก (multi-selectable).
3. AI generates the **world brief** (one background `complete()` call): ชื่อโลก, สภาพภูมิประเทศ/การเมือง 2-3 ย่อหน้า, จุดเริ่มเรื่อง (situation), 3 ตะขอเรื่อง (hooks), 1-2 ตัวละครเริ่มต้น. Player can 🎲 regenerate before accepting.
4. Stored as the campaign's `worldBrief` — injected into every GM prompt.

## Hero creation (สร้างนักสำรวจ)

- Name + free-text concept ("นักเวทผู้ถูกขับไล่", "ทหารรับจ้างหาเลี้ยงลูก") + class-lite pick: นักดาบ · นักเวท · โจร · นักบวช · หมอผี · นักล่า · กำหนดเอง.
- AI proposes stat allocation + starting kit + a one-paragraph ปูมหลัง (background hook tying them to the world brief) — player can ✏️ tweak points or 🎲 reroll. (Same UX pattern as the sibling app's AI-fill card: AI fills, human approves.)
- Starting kit by class (e.g. นักดาบ: ดาบเหล็ก d6+chain armor+เปื้อน้ำ 2 ขวด); 100 gold-ish starting money by setting.

## The turn loop (heart of the game)

```
Player input  — free text ("ผมจะถามชาวบ้านเรื่องรอยเท้า"), quick actions (⚔️ โจมตี 🔍 ตรวจสอบ 💬 พูดคุย 🏃 หนี), or 🎲 custom roll
      ↓
App resolves  — parses declared mechanics; rolls dice SERVER-SIDE; applies damage/HP/gold/conditions to world state; logs resolution
      ↓
GM narrates   — SSE stream: outcome + world reaction + NPC dialogue (named speakers), 2-4 ย่อหน้า, ends on a hook;
                📊 สถานะ block appended ONLY when something mechanical changed
      ↓
State update  — background complete() call → updated world state JSON (zod-validated) → saved + UI panels refresh
      ↓
Suggest       — 3 tappable next-action chips (sibling app's suggestion pattern, adventure-flavored)
```

- **Quick actions are shortcuts, not limits** — the player can always type anything; the GM handles off-menu attempts with stat checks when they'd fail interestingly. "Unlimited direction" is the product.
- **Choice chips (คำตอบให้เลือก)** — the sibling app's suggestion system, adapted: after every GM turn, N tappable player-action options render in-chat under the narration (a พูด / ทำ / เปลี่ยนทิศ mix), generated by a small background call (`prompts/suggestions.md`, N parameterized), cached per turn; tapping one SENDS it immediately. **N is user-configurable** — settings slider 0 (= off) to 6, default 3. Free-text input is ALWAYS available alongside — chips are accelerators, never a limit (the "unlimited direction" pillar). Proven pattern + known pitfall (character-voice leak — needs the few-shot player-voice guard) from the sibling project.

## Save / load / resume

- Autosave after every completed turn (messages + world state in SQLite, transactional).
- **Checkpoints** (จุดบันทึก): manual saves with note, unlimited-ish (cap 30), restore = snapshot swap (auto-snapshot current state first — nothing is ever lost; same rule as the sibling app).
- Resume: "ก่อนหน้านี้…" recap card built from the session summary (see `03_WORLD_STATE.md` memory tiers), then the last scene.
- Campaign end states: ตาย (see death above) · จบเรื่อง (player declares) · พัก (just leave).

## Scene illustration (free-asset library, AI-picked — no GPU)

Decided 2026-10-06: do NOT generate scene art with ComfyUI during play — the GPU is running the GM; image gen would contend for VRAM. Instead: a curated local library of **free-to-use art**, and the AI picks from it to illustrate the current scene.

- **Library**: `static/assets/scenes/` (image binaries, gitignored) + `assets/manifest.json` (committed) with one entry per image: `{file, tags[], setting[], source, license, author}`.
- **License discipline** (the user's explicit worry): only **CC0 / public domain / explicitly free-license** art — Kenney.nl, OpenGameArt (CC0 + CC-BY), Pixabay, Unsplash, AI-generated galleries with clear permissive terms. Every manifest entry records source URL + license + author; CC-BY attribution shows in the art tooltip. No scraped or copyrighted art, ever.
- **Fetch script**: `scripts/fetch-assets.mjs` re-downloads from the manifest after a fresh clone (same pattern as the sibling app's avatar re-downloader). It validates every URL — http/https only, host resolved and checked (never localhost/loopback/private/reserved addresses) — and caps per-file size, writing atomically.
- **Picker**: the world-state update call also returns `world.sceneTag` chosen from a **controlled vocabulary** = the manifest's tag list (inn · tavern · forest · dungeon · market · campfire · night · rain · desert · temple · …). zod validates against the vocabulary; invalid → keep the previous tag. The client matches `sceneTag` (+ setting filter) to assets, avoids recently-used repeats, and crossfades the scene card (motion). No match → keep previous art or none — never a broken image.
- **Manual override**: a small 🖼 button on the scene card lets the player pick any library image for the scene.
- v1 asset budget: ~80–120 images covering ~25 tags across the setting presets (ดาบและเวทมนตร์ / ไซไฟ / สยองขวัญ / ตำนานไทย). *(Progress 2026-10-06: 37 images — 13 locally-generated CC0 SVG scenes + 24 curated from Wikimedia Commons: public-domain Romantic paintings (Friedrich, John Martin, Brouwer, Teniers, Caffi), PD Ayutthaya photography for ตำนานไทย, and NASA/ESA/Webb imagery for ไซไฟ, plus CC-BY/CC-BY-SA entries whose attribution is recorded in the manifest. Curation continues — append verified `url` entries to the manifest and run `npm run assets`.)*

## Hero portraits (local ComfyUI library, anime-only)

Decided 2026-10-06: character faces come from a **pre-generated local library**, never generated live (same GPU-contention rule as scene art) and never fetched from the internet.

- **Library**: `static/assets/portraits/` (binaries, gitignored) + `assets/portraits.json` (committed) — 192 anime portraits in four groups: **heroes** (6 ages × 6 roles × 2 checkpoints = 72), **personality variants** (man/woman × roles × cheerful/stern/dull = 72), **professions** (innkeeper, guard, blacksmith, servant, farmer, priest × man/woman = 24), and a **monster bestiary** (goblin, orc, slime, dragon, skeleton, ghost, wolf, bandit, troll, kobold, golem, harpy = 24). Checkpoints: Illustrious-XL + NoobAI-XL. All images are **user-owned, generated on the user's own rig**; prompts are SFW (NSFW terms sit in the negative prompt). A photorealistic bucket (ArienMixXL / Diving-Real-Asian) was generated the same day and **dropped by user review** — the style didn't match the app; the catalog keeps a `bucket` field so a future style expansion stays schema-compatible.
- **Auto-pick**: the hero's class maps to a role tag (`นักเวท`→mystic, `นักดาบ`/`อัศวิน`→warrior, …); the pick is deterministic per hero name (FNV hash) so a hero keeps the same face across reloads, and the hero's concept line narrows the temperament (a "ร่าเริง" concept rolls a cheerful face). NPCs (and enemies) route via `pickNpcPortrait` Thai keyword matching: monster names (กอบลิน, มังกร, สไลม์…) → bestiary, professions (แม่เม้า, ยาม, ช่างตีเหล็ก…) → profession group, gender/age words (ป้า/ลุง/ชรา…) → the right pool. **GM portrait hints (2026-10-07)**: the state tracker writes a one-line `portrait` appearance hint (เพศ วัย อารมณ์) for every NEW NPC — temperament words (ยิ้มแย้ม/หน้านิ่ง/เหนื่อยอ่อน) pick the cheerful/stern/dull variant, and when the hint is silent the NPC's disposition biases the face (ภักดี smiles, เกลียดชัง glares). The model only DESCRIBES — the app picks the file (`sceneTag` pattern). Hints are carried forward app-side in `acceptStateUpdate` (the tracker never sees them, so omission would otherwise wipe them each turn). Hero faces carry the manual 🖼 override on the game screen; NPC faces show in the NPC panel (auto only).
- **Regenerate**: `npm run portraits` (offline, ~20 s/image on the RTX 5060; idempotent resume). Prompts live in `scripts/generate-portraits.mjs` — keep `solo` + `1boy`/`1girl` anchors and the anti-"character sheet" negatives, or danbooru-trained checkpoints leak multi-view expression sheets.

## UI screens (desktop-first)

1. **Gate screen** — campaign list (cards: world name, hero, day/act, last played) + สร้างโลกใหม่ wizard.
2. **Game screen** — three-zone layout: left rail (hero sheet + inventory + quests, collapsible), center narration column (scene art card at the top illustrating the current scene, then dialogue/narration/status blocks rendered like the sibling app's novel cards), bottom command bar (input + quick actions + dice + suggestions). Right side reserved for future map/party rail.
3. **Modals/sheets** — world brief, hero creation/level-up, checkpoint manager, settings (model URL, narration length, 🎬 extras toggle, **จำนวนตัวเลือกคำตอบ 0–6 ค่าเริ่มต้น 3**), content-policy reminder.
4. Mobile pass (P3): rail becomes bottom tabs, narration full-width, quick actions as a swipe row — same responsive philosophy as the sibling app but PC is the primary target.
