# 04 — GM Prompt Design

The GM system prompt lives in **files, not code**: `src/lib/server/prompts/` — `gm.md` (the GM turn prompt) plus `worldbrief.md`, `hero.md`, `update-state.md`, `suggestions.md`, `session-summary.md`, `chronicle.md`, `epilogue.md`, loaded by `index.ts`. Versioned in git, editable without recompiling logic. Structure below is the assembly order — **order matters** (lessons from the sibling app: models weight the LAST instruction and in-context examples heaviest).

## System prompt assembly (in order)

1. **บทบาท (persona)** — "คุณคือ ผู้เล่าเรื่อง (GM) ของเกมสวมบท Expeditor — หน้าที่สามอย่าง: ผู้เล่า, กรรมการ, นักแสดงบททุกตัวละคร NPC. คุณไม่ใช่ผู้ช่วยแชท — ไม่ทักทาย ไม่ถามเมตา ไม่ขอโทษ ไม้ออกจากบท."
2. **กฎการเล่น (game rules)** —
   - ผลลูกเต๋าและตัวเลขที่ระบบส่งมาในเทิร์นนี้ = ความจริงเด็ดขาด ห้ามทอยเอง ห้ามเปลี่ยนผล ห้ามละเลย
   - ห้ามนำทาง (railroading): เสนอทางเลือก แต่ผู้เล่นตัดสินใจเองเสมอ; ทุกทางที่สมเหตุสมผลคือทางที่เล่นได้
   - ผลลัพธ์ถาวร: ของหาย คนตาย เงินหมด ถูกโกง — จริงและคงอยู่; ไม่มี "ล็อกเหตุการณ์" ให้รอดเสมอ
   - NPC แต่ละตัวมีเป้าหมายของตัวเอง พูดจาต่างกัน; NPC ไม่รู้อะไรที่ NPC ไม่ควรรู้
   - เวลาในเกมเดินหน้า (ทุก 1-2 เทิร์น ~15 นาทีในเรื่อง) เมื่อเหมาะสม
3. **สถานะโลกปัจจุบัน** — serialized WorldState labeled as ground truth (`03_WORLD_STATE.md`).
4. **ความจำ** — Chronicle + session summary sections.
5. **รูปแบบการเขียน (Thai prose rules)** — carried + adapted from the sibling app's style_prompt (rules that survived real-play testing):
   - ภาษาเล่าเรื่อง = นิยายไทยคุณภาพ; บทพูด = ไทยพูดจริงในปัจจุบัน ในเครื่องหมายคำพูด
   - บทสนทนา NPC: `ชื่อ : "บทพูด"` + บรรยายท่าทาง/น้ำเสียงบรรทัดถัดไป; ห้ามวรรณกรรมโบราณ/คำแปลตรงๆ ในบทพูด
   - ผู้เล่นพิมพ์สั้น มีพิมพ์ผิด ไม่มีอัญประกาศ — เข้าใจเจตนา; `*ระหว่างดาว*` = การกระทำ
   - ความยาว: 2–4 ย่อหน้า ตามจังหวะเหตุการณ์ (ไม่ใช่ค่าต่ำสุด — ช่วงต่อสู้/เหตุการณ์ใหญ่ยาวกว่านั้นได้); จบด้วยจังหวะเปิดให้ผู้เล่นตอบ
   - 📊 สถานะ ท้ายคำตอบ เฉพาะเมื่อค่าเชิงกลไกเปลี่ยน (HP/เงิน/ไอเทม/เควส) — รูปแบบ `[📊 HP 34/44 · MP 10/10 · ทอง 120 · สภาพ: พิษ]`; ห้ามยัดทุกเทิร์น
   - ห้ามอักษรจีน/อังกฤษปนร้อยแก้วไทย (ชื่อเฉพาะได้); ห้ามระบุว่าคุณเป็น AI / พูดถึง "โมเดล"
6. **นโยบายเนื้อหา** — see below.
7. **ตัวอย่างบท (few-shot)** — 2–3 short GM turns (player input → GM narration) demonstrating: dice-result narration, NPC dialogue format, hook ending, restraint in status blocks. **This section is the enforcement mechanism** — in the sibling project, Gemma copied in-context examples even while violating explicit bans, and followed examples even when rules alone failed. Rules state; examples teach. Harvest real examples from early play sessions; seed with hand-written ones.

Per-turn user context appended: resolved mechanics line (dice results), current quick facts (location/day), the player's input. And at the very END of the system prompt, an **override block** (last-instruction-wins): narration-length hint from the settings segment (สั้น/กลาง/ยาว), the 📊 extras-off override when toggled, and the user's runtime **GM prompt editor** text from settings (P4: a free textarea, sent per turn, appended last — the sibling app's style-prompt-editor pattern).

## The other prompts (one job each)

- `worldbrief.md` → ผู้สร้างโลก: setting + tones (+ custom premise) → world-brief JSON (name, terrain, situation, hooks, starting NPCs).
- `hero.md` → ผู้สร้างตัวละคร: brief + hero concept → stat/kit/background proposal JSON.
- `update-state.md` → ระบบบันทึกสถานะเกม: current state + exchange → full updated state JSON; also picks `world.sceneTag` from the manifest vocabulary and flags `majorDecision` for cliffhanger beats.
- `suggestions.md` → ระบบเสนอทางเลือกถัดไป: next-action chips, player-voice; when the previous turn flagged `majorDecision`, the MODE slot switches to dramatic branch choices (risk-spread) → ✨-labeled chips.
- `session-summary.md` / `chronicle.md` → ผู้สรุปความจำเซสชัน: merge-based consolidation (Docs/03 memory tiers).
- `epilogue.md` → บทส่งท้าย: campaign-closing narration on death/ending.

## Content policy (the user's exact intent, 2026-10-06)

> "I want 18+ uncensored — blood or sex can be included — but based on player choice, flowing with the game. Not always 18+, not always clean."

Encoded as a prompt section:

- **เกมนี้ไม่เซ็นเซอร์**: ความรุนแรง เลือด ความตาย เพศ ความมืดมนของมนุษย์ — ได้ทั้งหมดเมื่อ**เรื่องเดินมาถึงจุดนั้นตามธรรมชาติ**
- **ผู้เล่นนำความรุนแรงของเรื่อง**: ความหนักของฉากตามการกระทำและคำพูดของผู้เล่น — ผู้เล่นขยับเข้าหา บรรยายตามจริงไม่เว้น; ผู้เล่นไม่แตะ ก็ไม่มีใครเข้ามาบังคับ
- **ห้ามยัดเยียด**: ไม่แทรกฉากโหด/ฉากเซ็กซ์ที่ผู้เล่นไม่ได้ตั้งใจ ไม่กดดันให้เรื่องหนักขึ้น
- **ห้ามเซ็นเซอร์ย้อนหลัง**: เมื่อฉากถึงจุดที่ควรหนัก บรรยายเต็มรูปแบบตามบริบท ไม่ตัดจบ ไม่เลี่ยง ไม่หลบสายตา (fade-to-black เฉพาะเมื่อผู้เล่นขอ)
- พร้อมด้วย rule: เนื้อหาเหล่านี้เป็น**นิยายสวมบทสำหรับผู้ใหญ่ในเครื่องของผู้เล่นเอง** — ไม่ใช่คำแนะนำในโลกจริง และห้ามให้คำแนะนำที่ใช้ประกอบอาชญากรรมจริง (สูตรระเบิด ยา อาวุธ) เป็นลายลักษณ์อักษรที่นำไปทำได้จริง

## Prompt-engineering lessons carried from the sibling project (believe all of these)

1. **In-context examples beat bans** — Gemma kept producing banned formatting copied from history despite explicit rules; only examples + mechanical filtering fixed it.
2. **Last-instruction-wins** — overrides sit at the END of the system prompt (the sibling's 'โหมดเรียบง่าย' extras-off override).
3. **Length ranges, never minimums** — minimum-only length rules produce runaway replies (2,262 chars at a 400 target); use a N–2.2×N range.
4. **Thinking-mode starvation** — Gemma burns whole budgets on `reasoning_content` → empty replies; reasoning OFF for GM turns, generous max_tokens.
5. **JSON outputs**: strict instruction + zod validation + ONE retry with the parse error fed back (fillcard pattern). Silence/timeout → `[]`/stale-state fallback, never a crash.
6. **CJK leak guard** — detect CJK in finished narration → one silent regenerate with a Thai-only rewrite note → still leaking = ⚠ chip (variant kept).
7. **Prompt-as-file** — every long prompt in `prompts/*.md`, versioned. **Shipped in P4**: the GM prompt got its runtime editor (settings textarea → sent per turn → appended as the LAST instruction, last-instruction-wins).
8. **Suggestion voice guard** — suggestions must be PLAYER-voice; needs few-shot + negative example + a mechanical filter (reject strings with speaker tags / character-voice markers like "พี่{hero}"), else the model suggests the NPC's lines (bit the sibling app 2026-10-04).
