# 03 — World State & Memory

The world state is the single source of truth about "what is true in the game". The model narrates; **the state records**. This is the anti-hallucination backbone — the difference between this and AI Dungeon's decade-old coherence problem is that state lives in OUR database, not in the model's fading context window.

## SQLite schema (Drizzle, `lib/server/db/schema.ts`)

```ts
campaigns   { id, title, setting, tone, worldBrief, stateJson,    // world-state JSON (below)
              createdAt, updatedAt, lastPlayedAt, ended: null|'dead'|'epilogue' }
messages    { id, campaignId, seq, role: 'player'|'gm'|'system',
              content, meta,   // meta: {dice?, resolution?, stateDiff?, sugCache?}
              createdAt }
checkpoints { id, campaignId, note, stateJson, messagesUpTo: seq, createdAt }
```

- `stateJson` is a JSON blob validated by a **zod schema** — the app never trusts it unvalidated, wherever it came from (LLM, migration, import).
- Messages are append-only; a GM turn may be aborted mid-stream (only completed turns save — same rule as the sibling app's stop feature).
- WAL mode; every turn = one transaction (messages + state together).

## World-state zod schema (v1)

```ts
WorldState = {
  hero: {
    name, concept, klass,
    level, xp,
    stats: { str, agi, dex, vit, int, spi, cha, luk },  // 1..10 each (8 stats — see 02_GAME_DESIGN)
    hp, maxHp, mp, maxMp,
    conditions: string[],                          // ['พิษ', 'บาดเจ็บขาซ้าย']
    equipment: { weapon?, armor?, accessory? },
    inventory: { name, qty, note? }[],
    gold, luckPoints,
  },
  world: {
    day, timeOfDay: 'เช้า'|'สาย'|'บ่าย'|'เย็น'|'กลางคืน',
    location,          // "หมู่บ้านท่าไม้ — ร้านของชำของลุงหมึก"
    weather, era,
    sceneTag,        // controlled vocabulary from assets/manifest.json (02 § Scene illustration)
    flags: Record<string, boolean>,                // 'เปิดประตูวิหาร': true
    lore: string[],                                // bounded list of discovered facts
  },
  npcs: { id, name, role, disposition,   // -3..+3 scale, Thai gloss on render
          location, status, note }[],    // status: 'มีชีวิต'|'ตาย'|'หายตัว'…
  quests: { id, title, status: 'active'|'done'|'failed',
            steps: string[], note? }[],
  recentEvents: string[],   // bounded ~20, newest last (deque)
}
```

Budget: the serialized state stays ≤ ~2.5k tokens. `lore` capped 40 (oldest pruned by importance=order), `npcs` capped 60 (dead/absent NPCs compacted to one line), `recentEvents` 20. Migration story: zod schema versioned (`stateV: 1`) — additive fields only within v1; a v2 needs a migration + tests.

## Update pipeline (after each GM turn)

1. GM narration streamed + saved (role `gm`).
2. Background non-stream `complete()` call (`prompts/update-state.md`): system prompt = "คุณคือระบบบันทึกสถานะเกม — คืน JSON สถานะที่อัปเดตแล้วทั้งก้อน" + current state + the player input + the narration just produced. The same call chooses `world.sceneTag` from the manifest's tag vocabulary supplied in the prompt (invalid choice → keep previous).
3. **zod-parse the output.** Fail → ONE retry with the zod error pasted back (sibling-app fillcard pattern). Fail again → keep the previous state, set `stateStale: true` → UI shows a subtle "⚠ สถานะไม่ได้อัปเดตรอบนี้" chip. The game continues; state integrity never breaks.
4. **Server-side authoritative merge**: mechanical mutations the APP already applied this turn (dice damage, gold spent, HP potion, LUK spend) are re-applied over the LLM's state (app values win — the LLM never overrides app math).
5. Save transactionally. UI panels (hero sheet, quests, NPC list) reactively re-render.

Why full-state rewrite instead of JSON-patch: the state is small (~2.5k tokens), full rewrite is one prompt with no patch-semantics failure modes, and zod validates the whole thing anyway. Revisit only if drift between rewrite calls becomes a real problem.

## Memory tiers (what the GM "remembers")

Three tiers injected into every GM prompt — evolved from the sibling app's auto_memory/story_memory, adapted for campaigns:

| Tier | What | Size | Built |
|---|---|---|---|
| **Window** | Last N messages verbatim | ~6k chars / 12 msgs | rolling slice of `messages` |
| **Session summary** | "เซสชันนี้เกิดอะไรขึ้น" running summary | ≤ 900 chars | background consolidation call every 8 turns (merge-based: existing summary + new exchange → updated summary, early facts survive) |
| **Chronicle** | Whole-campaign structured memory: ความสัมพันธ์สำคัญ / เหตุการณ์ใหญ่ / ข้อเท็จจริงที่ต้องจำ / ศัตรูและหนี้เลือด | ≤ 2,600 chars | consolidation every 20 turns (or `force`), prompt includes existing chronicle so early facts persist; huge histories chunked head-4k + tail-8k (sibling app's `_story_consolidate` pattern) |

Prompt assembly order (system prompt): GM persona + rules → **world state (ground truth)** → chronicle → session summary → style/format rules → few-shot examples. Window messages follow as chat history. (Last-instruction-wins ordering matters — see `04_GM_PROMPT.md`.)

## Truth rules for the model

- The injected state section is labeled `สถานะโลกปัจจุบัน (ความจริงของเกม — ใช้ข้อมูลนี้เท่านั้น)`. The GM may not contradict HP/gold/locations/NPC facts in narration.
- Narrative texture (an NPC's mood detail, weather flavor) is the GM's freedom; mechanical facts are the app's.
- If the player narrates something contradicting state ("ผมคว้าดาบทิ้งไปแล้ว!"), the GM reconciles in-fiction, and the state update call reflects the resolution.
