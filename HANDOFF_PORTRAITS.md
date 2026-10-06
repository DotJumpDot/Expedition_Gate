# HANDOFF — Character Portrait Library (for the Flash session)

> Written by the GLM-5.3 session on 2026-10-06 after the user asked to switch.
> Read this file fully before touching anything. Do the remaining work exactly
> as specified — the design decisions are already made; don't re-litigate.

## 0. What this feature is

Pre-generate ~144 character portraits with the user's local ComfyUI
(`C:\Code\Picture_Model`, API `http://127.0.0.1:8188`), commit the CATALOG
(not binaries), and make the game auto-pick a fitting portrait for every hero.
Two style buckets exist and must NEVER mix inside one world:

- `anime` ← Illustrious-XL v2.0 + NoobAI-XL v1.1 checkpoints
- `realistic` ← ArienMixXL v4.0 (Asian Portrait) + Diving-Real-Asian v7

Content rating: the generation prompts are SFW by design (NSFW terms are in the
negative prompt). No UI rating work is needed.

## 1. Current state (what is ALREADY DONE — do not redo)

1. **`expedition_gate/scripts/generate-portraits.mjs`** — complete, tested.
   - Matrix: 6 ages (`boy girl man woman grandpa grandma`) × 6 roles
     (`poor commoner merchant warrior mystic noble`) × 4 checkpoints = 144.
   - Deterministic seeds (FNV hash of filename stem), 832×1216, dpmpp_2m/karras,
     26 steps, cfg 6, SFW negative prompt.
   - Idempotent: skips files already on disk AND in the manifest; rewrites the
     manifest after every image (safe to interrupt/rerun).
   - CLI: `node scripts/generate-portraits.mjs [--dry-run] [--only anime|realistic]`
   - Env: `COMFY_URL` (default `http://127.0.0.1:8188`).
2. **ComfyUI was started by my session** (`run_nvidia_gpu.bat` from
   `C:\Code\Picture_Model\ComfyUI_windows_portable`) — it was DOWN when I began.
3. **Generation was running** when this handoff was written: 7/144 done,
   ~20 s/image → full run ≈ 45–50 min. Output:
   - binaries → `expedition_gate/static/assets/portraits/*.png` (already
     gitignored — the whole `static/assets/` tree is ignored)
   - catalog → `expedition_gate/assets/portraits.json` (COMMITTED, like
     `assets/manifest.json` for scenes)
4. Nothing else is built. The game does not use portraits yet.

### Session-handover realities (IMPORTANT)

My background processes may die with my session. Flash must, in order:

```bash
# a) is generation still alive? (count should keep growing)
ls /c/Code/Expedition_Gate/expedition_gate/static/assets/portraits/ | wc -l
# b) if stalled AND ComfyUI still up:
curl -s --max-time 4 http://127.0.0.1:8188/system_stats | head -c 120
# c) if ComfyUI died: check port 8188 for a zombie (netstat -ano | grep :8188),
#    kill stale PID if any (taskkill //PID <pid> //F), then START it:
cd "/c/Code/Picture_Model/ComfyUI_windows_portable" && ./run_nvidia_gpu.bat   # background
# d) resume (idempotent — only missing images are generated):
cd /c/Code/Expedition_Gate/expedition_gate && node scripts/generate-portraits.mjs
```

The user pre-approved starting ComfyUI for THIS task. Do NOT touch llama-server
(it is stopped; tests use fake-llama). After the whole feature is verified and
committed, STOP ComfyUI if you started it (it's the user's server; leave the
machine clean — he games on it).

## 2. The manifest (already produced by the script)

`expedition_gate/assets/portraits.json`:

```json
{
	"$comment": "...",
	"portraits": [
		{
			"file": "anime_man_noble_noobai.png",
			"bucket": "anime",              // "anime" | "realistic"  — the ONLY two values
			"tags": ["man", "noble"],       // [age, role] — fixed vocabularies:
			                                //   age: boy girl man woman grandpa grandma
			                                //   role: poor commoner merchant warrior mystic noble
			"settings": ["any"],
			"source": "comfyui:Illustrious-XL-v2.0.safetensors",
			"license": "locally-generated, user-owned",
			"author": "user (ComfyUI)"
		}
	]
}
```

144 entries when complete (72 anime, 72 realistic). Image URL at runtime:
`/assets/portraits/<file>` (binaries under `static/assets/portraits/`).

## 3. Remaining work — do IN THIS ORDER

### Step 1 — API endpoint `GET /api/portraits`

Mirror `src/routes/api/scenes/+server.ts` exactly (read it first): read
`assets/portraits.json`, map entries to
`{ file, bucket, tags, url: '/assets/portraits/'+file, available: existsSync('static/assets/portraits', file) }`,
return `{ portraits }` with `cache-control: no-store`, and `{ portraits: [] }`
on any error. Manifest read must tolerate a MISSING file (fresh clone before
generation) — return empty, never 500.

### Step 2 — `artStyle` on presets and scenarios (the no-mixing rule)

`src/lib/game/worldstate.ts` — extend `interface SettingPreset` with
`artStyle: 'anime' | 'realistic'` and add the field to ALL presets using THIS
table (decided — the realistic Asian checkpoints fit the Asian settings; the
rest are European/modern fantasy → anime):

| preset key | artStyle |
|---|---|
| sword_sorcery, magic_academy, frozen_north_noble, system_power, fallen_noble_sword, time_control, demon_lord_reborn, pirate_sea, post_apoc, steampunk, scifi, horror, custom | `anime` |
| thai_legend, eastern_empire, wuxia | `realistic` |

`src/lib/game/scenarios.ts` — add `artStyle` to `interface Scenario` + all 5:
frozen_north_noble `anime`, magic_academy `anime`, system_power `realistic`,
fallen_noble_sword `anime`, time_control `realistic`.

`src/lib/game/portraits.ts` (NEW, isomorphic — no node imports):

```ts
export type PortraitBucket = 'anime' | 'realistic';
export interface PortraitEntry { file: string; bucket: PortraitBucket; tags: string[]; url?: string; available?: boolean }
/** Settings override → effective style. 'auto' follows the preset/scenario. */
export function effectiveStyle(override: 'auto' | PortraitBucket, presetStyle: PortraitBucket): PortraitBucket
/** klass (Thai class string) → role tag. */
export function roleTagForClass(klass: string): 'poor'|'commoner'|'merchant'|'warrior'|'mystic'|'noble'
/** Deterministic pick: filter bucket → prefer tag match → stable hash tie-break. Returns null when library empty. */
export function pickPortrait(entries: PortraitEntry[], bucket: PortraitBucket, klass: string, seedKey: string): PortraitEntry | null
```

- `roleTagForClass` mapping (substring match, lowercase, first hit wins):
  นักเวท|หมอผี|นักบวช|นักปราชญ์|เวท → `mystic`; นักดาบ|อัศวิน|นักล่า|นักธนู|ทหาร|ดาบ → `warrior`;
  พ่อค้า|ค้าขาย|merchant → `merchant`; กษัตริย์|ราชา|ราชินี|เจ้าคุณ|ขุนนาง|เจ้าเมือง → `noble`;
  โจร|ขโมย → `poor`; else → `commoner`.
- `pickPortrait`: keep entries where `bucket` matches AND (if url/available
  present, `available !== false`); prefer entries whose tags include
  `roleTagForClass(klass)`; among the remainder pick by FNV-1a hash of
  `seedKey` (hero name) — stable across reloads. No age inference exists
  (heroes have no age field) — the hash spreads ages naturally.

### Step 3 — settings override

`src/lib/stores/settings.svelte.ts`: add `portraitStyle: 'auto' | 'anime' | 'realistic'`
(default `'auto'`), persisted in the same JSON, validated on load, with
`setPortraitStyle`. Settings page (`src/routes/settings/+page.svelte`) — in the
การแสดงผล card, a 3-way segmented control exactly like the hero-panel-side one:
อัตโนมัติ / อนิเมะ / สมจริง.

### Step 4 — `HeroPortrait.svelte` component

New `src/lib/components/game/HeroPortrait.svelte`. Model it on
`SceneCard.svelte` (READ IT FIRST — it already solved fetch/availability,
override-in-localStorage, popover pattern):

- Props: `{ world: WorldState; setting: string; campaignId: string }`.
- `onMount` fetch `/api/portraits` (no-store), keep only `available`.
- Effective bucket = `settings.portraitStyle === 'auto' ? settingPreset(setting).artStyle : settings.portraitStyle`.
  (Scenarios create campaigns with a real preset key, so preset lookup covers them.)
- Chosen = localStorage `gate.portraitOverride.<campaignId>` (file name) if it
  still exists in the filtered library, else `pickPortrait(...)`.
- Render: a rounded portrait block (approx 64×80 to 72×90 px, `object-cover`,
  themed border `border-border/70`, subtle gold ring on hover) showing the
  image, or a muted fallback tile with the hero's initial when the library is
  empty (fresh clone — MUST look intentional, not broken).
- A small 🖼 button → popover picker (copy SceneCard's `.picker` incl. its
  hard-won lessons: the popover must NOT be clipped — the ART layer clips
  itself, the card must not use `overflow: hidden`; z-index 45). Grid of
  thumbnails FILTERED TO THE EFFECTIVE BUCKET ONLY (never show the other
  style); a "ใช้อัตโนมัติ" row clears the override. Show the license line
  (`locally-generated, user-owned`) like the scene picker does.
- prefers-reduced-motion + hover-guard media rules like every other component.

### Step 5 — wire in

1. `HeroSheet.svelte` header: place the portrait LEFT of the name/class block
   (needs `setting` + `campaignId` props — thread them from
   `campaign/[id]/+page.svelte`, both the desktop rail AND the mobile drawer
   instances).
2. Wizard (`WorldWizard.svelte`), hero step, AFTER a proposal/ready hero is
   chosen: a small read-only preview (auto-pick by the selected preset's
   artStyle) next to the stat area with the caption "เปลี่ยนรูปได้ในหน้าเกม".
   Read-only — the override UI lives on the game screen only (the campaign id
   does not exist yet in the wizard; do NOT invent a pending-portrait stash).

### Step 6 — tests (`tests/engine/portraits.test.ts`, NEW)

Mirror the style of `tests/engine/scenarios.test.ts`:

1. `assets/portraits.json` parses; every entry has bucket ∈ {anime, realistic},
   tags = one age + one role from the fixed vocab, file ends `.png`.
   (If the manifest is missing/incomplete because generation hasn't finished,
   SKIP that assertion block with a clear message instead of failing — but by
   the time you run this, generation should be complete; verify count ≥ 144.)
2. `effectiveStyle`: override wins; 'auto' follows preset.
3. `roleTagForClass`: one case per mapping row + default.
4. `pickPortrait`: bucket filtering (never returns the other bucket), role
   preference, determinism (same seedKey → same pick), empty-library → null.
5. Every preset in `SETTING_PRESETS` and every scenario has a valid `artStyle`.

### Step 7 — docs + roadmap

- `README.md`: "What's in the game" — add a Hero portrait bullet (auto-picked
  per world style, anime/realistic never mixed, manual 🖼 override, library
  generated locally via `npm run portraits` — see below).
- `package.json` scripts: `"portraits": "node scripts/generate-portraits.mjs"`.
- `Docs/02_GAME_DESIGN.md`: short § Hero portraits (bucket rule, matrix, script).
- `Docs/05_ROADMAP.md`: new dated subsection listing the feature (like the
  previous ones), including "ComfyUI used OFFLINE only — the P5 live-generation
  door stays closed".
- `AGENTS.md` repo-layout: add `assets/portraits.json` +
  `static/assets/portraits/` + `scripts/generate-portraits.mjs` lines, and
  update the "Open items" sentence if needed.

## 4. Verification checklist (ALL must pass — run gates UNMASKED)

```bash
cd expedition_gate
npm run lint; echo "LINT_EXIT=$?"        # MUST print LINT_EXIT=0  (never `| tail` — that ate a failure once)
npm run check                            # 0 errors 0 warnings
npm test                                 # all green incl. new portraits.test.ts
npm run build                            # green
npm run e2e:pw                           # 3/3 specs
```

Browser (DOM assertions, not screenshots — machine rule):

- open an existing campaign → portrait renders in HeroSheet, `<img>` src
  starts `/assets/portraits/`, natural size > 0 (image actually loaded);
- picker opens IN FRONT of content (not clipped), shows ONLY one bucket;
- pick an override → survives a page reload;
- a thai_legend campaign shows realistic portraits; a sword_sorcery campaign
  shows anime; with settings override สมจริง a sword_sorcery campaign shows
  realistic (override beats preset);
- fresh-clone fallback: temporarily rename `static/assets/portraits` →
  fallback tile renders, nothing crashes, `/api/portraits` returns available:false.

e2e pitfall from this session: before `npm run e2e:pw`, make sure ports 5173
and 8090 have NO listeners (`netstat -ano | grep -E ':(5173|8090)'`) — the
Playwright config uses `reuseExistingServer: true` and will happily reuse YOUR
dev server that lacks the e2e env (LLAMA_URL) and the specs will 500.

## 5. Hard rules / gotchas (each one bit this project before)

1. **Never pipe gate commands through `tail`/`grep` in a `&&` chain** — the
   pipe eats the exit code (a 15-error lint failure slipped through exactly
   this way).
2. **Do not add `class="dark"` to `<body>`** or any wrapper — the `.dark` token
   block re-declares every CSS var on that element and silently overrides the
   active `[data-theme]` for everything inside (fixed once; never again).
3. **Popovers inside cards**: the clipping container must not have
   `overflow: hidden`; give the popover `z-index: 45` (SceneCard pattern).
4. **All colors via theme tokens** (`var(--color-gold)` etc.) — no raw oklch
   literals in new components (the 6-theme system depends on it).
5. localStorage is per-origin — dev-server port hops (5173→5175) look like
   "settings vanished"; that's not a bug.
6. English in code/comments/commits; Thai only for game UI strings.
   Short one-line commit subjects. Never commit `data/`, binaries, or
   gameplay exports. Binaries are already ignored via `static/assets/`.
7. Don't restart the user's servers; ComfyUI handling is covered in §1.
8. Tests never touch a live model — fake-llama (:8090) only.

## 6. Definition of done

- [ ] 144 portraits on disk + 144 manifest entries (script exits 0 with "done")
- [ ] /api/portraits serves the catalog with availability flags
- [ ] artStyle on all presets+scenarios; settings override works
- [ ] HeroSheet portrait: auto-pick (stable per hero), override picker
      (bucket-filtered), fallback tile when library absent
- [ ] Wizard shows the read-only preview after hero acceptance
- [ ] portraits.test.ts green; all gates + 3/3 e2e green (unmasked lint)
- [ ] Docs + roadmap + AGENTS updated; `npm run portraits` script added
- [ ] One commit, short subject (e.g. "hero portraits: local ComfyUI library,
      auto-pick + override, anime/realistic per world")
- [ ] ComfyUI stopped (if you started it), no stray listeners on 5173/8090/8188
- [ ] Tell the user to have GLM-5.3 recheck when done (this file's §4–§6 is
      the recheck script)
