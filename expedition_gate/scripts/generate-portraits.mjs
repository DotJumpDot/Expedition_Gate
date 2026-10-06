/**
 * Batch character-portrait generator (เริ่มที่ Hero portrait library).
 *
 * Drives the LOCAL ComfyUI API (Picture_Model, default http://127.0.0.1:8188)
 * to pre-generate the portrait library the game picks heroes from. Generation
 * happens OFFLINE (never during GM turns) — the GPU-contention rule from
 * Docs/02 stays intact.
 *
 * Matrix: 6 ages × 6 roles × 2 checkpoints = 72 portraits (anime only —
 * Illustrious-XL v2.0 + NoobAI-XL v1.1; the photoreal checkpoints were tried
 * and dropped by user review, see Docs/02 § Hero portraits).
 *
 * Usage (from expedition_gate/):
 *   node scripts/generate-portraits.mjs            # everything missing
 *   node scripts/generate-portraits.mjs --dry-run  # print the plan only
 *
 * Idempotent: existing files are skipped, the manifest is rewritten after
 * every image, so an interrupted run resumes cleanly.
 * Output: static/assets/portraits/*.png (gitignored) + assets/portraits.json
 * (committed — the library catalog, like the scene-art manifest).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMFY = process.env.COMFY_URL ?? 'http://127.0.0.1:8188';
const OUT_DIR = resolve('static/assets/portraits');
const MANIFEST = resolve('assets/portraits.json');

// --- the matrix -------------------------------------------------------------

const AGES = /** @type {const} */ ([
	['boy', 'young boy around 10 years old'],
	['girl', 'young girl around 10 years old'],
	['man', 'adult asian man in his 30s'],
	['woman', 'adult asian woman in his 30s'],
	['grandpa', 'elderly asian man in his 70s'],
	['grandma', 'elderly asian woman in his 70s']
]);

const ROLES = /** @type {const} */ ([
	['poor', 'poor peasant, patched simple clothes, weathered face, resilient expression'],
	['commoner', 'ordinary townsperson, simple neat clothes, friendly warm expression'],
	['merchant', 'traveling merchant, layered practical clothes, satchel, shrewd smile'],
	['warrior', 'seasoned warrior, light armor, sword held at shoulder, scarred, determined'],
	['mystic', 'mystic sage, dark robes with talisman beads, calm piercing gaze'],
	['noble', 'wealthy noble aristocrat, ornate embroidered outfit, jewelry, proud posture']
]);

// Personality variants on the two adult genders — the same merchant woman can
// be a cheerful soul or a dull tired one, and the picker should show both.
const GENDERS = /** @type {const} */ ([
	['man', 'adult asian man in his 30s'],
	['woman', 'adult asian woman in her 30s']
]);
const EXPRESSIONS = /** @type {const} */ ([
	['cheerful', 'bright cheerful smile, warm sparkling eyes, open friendly face'],
	['stern', 'stern serious expression, sharp focused gaze, set jaw'],
	['dull', 'tired dull expression, weary half-lidded eyes, flat mouth']
]);

// NPC professions the hero matrix doesn't cover (inn staff, watch, crafts…).
const PROFESSIONS = /** @type {const} */ ([
	['innkeeper', 'innkeeper, waistcoat and apron, holding a mug and towel, warm tavern keeper'],
	['guard', 'town watch guard, light chainmail and tabard, spear on shoulder, watchful'],
	[
		'blacksmith',
		'blacksmith, leather apron over simple clothes, soot-smudged cheeks, holding a hammer'
	],
	['servant', 'house servant, neat simple uniform, humble polite demeanor'],
	['farmer', 'farm worker, straw hat, practical rough-spun clothes, sun-weathered'],
	['priest', 'temple priest, layered vestments, prayer beads, serene devout look']
]);

// Common bestiary — the GM meets these constantly; portraits surface in the NPC panel.
const MONSTERS = /** @type {const} */ ([
	['goblin', 'small green goblin, big ears, mischievous grin, crude leather rags'],
	['orc', 'burly green orc warrior, tusks, crude armor, battle-scarred'],
	['slime', 'translucent blue slime creature, glossy jelly body, big round eyes'],
	['dragon', 'young dragon, gleaming scales, small wings, curled horns, intelligent eyes'],
	['skeleton', 'animated skeleton warrior, worn bone armor, glowing eye sockets'],
	['ghost', 'pale translucent ghost, tattered flowing robes, sorrowful glow'],
	['wolf', 'dire wolf, thick dark fur, amber eyes, bared fangs'],
	['bandit', 'human bandit, hood and face scarf, daggers, calculating eyes'],
	['troll', 'hulking cave troll, mossy grey skin, underbite tusks, wooden club'],
	['kobold', 'small reptilian kobold, dull scales, snout, ragged clothes, timid'],
	['golem', 'stone golem, rune-carved rocky body, glowing core, imposing stance'],
	['harpy', 'harpy, great bird wings and talons, wild human face, wind-blown feathers']
]);

const MONSTER_STYLE =
	'fantasy bestiary illustration, game creature portrait, full body, centered, detailed, dark simple background';

const CHECKPOINTS = /** @type {const} */ ([
	{ file: 'Illustrious-XL-v2.0.safetensors', short: 'illustrious', bucket: 'anime' },
	{ file: 'NoobAI-XL v1.1 (Anime NSFW).safetensors', short: 'noobai', bucket: 'anime' }
]);

// A realistic bucket (ArienMixXL / Diving-Real-Asian) was generated and reviewed
// 2026-10-06 — the user judged the photoreal style a poor match for the app and
// dropped it. Anime-only library; the checkpoints above are all we regenerate.

const STYLE =
	'masterpiece, best quality, solo focus, single character, game character portrait, upper body, facing viewer, looking at viewer, detailed face, detailed eyes, anime style illustration, cel shading, soft lighting, dark simple background';

// SFW by design — the NSFW-capable checkpoints are steered away from it.
// The middle band exists because danbooru-trained checkpoints LOVE leaking
// multi-view "character sheets", expression grids and sketch pages into
// single-portrait requests (bitten 2026-10-06: 3-panel sketch pages in output).
const NEGATIVE =
	'text, watermark, signature, logo, cropped, out of frame, border, frame, multiple people, multiple views, multiple girls, multiple boys, character sheet, expression sheet, reference sheet, comic panel, storyboard, split screen, extra limbs, deformed hands, bad anatomy, blurry, lowres, jpeg artifacts, nsfw, nude, child nudity, monochrome, greyscale, sketch, lineart, unfinished, 2koma, 4koma';

// Danbooru-trained checkpoints bind hard to 1boy/1girl counters — it is the
// single most reliable "exactly one person" anchor.
function ageAnchor(ageKey) {
	return ageKey === 'girl' || ageKey === 'woman' || ageKey === 'grandma' ? '1girl' : '1boy';
}

// Seeds are deterministic per stem, so a rejected image would reproduce
// identically forever. Bump the number here to reroll that one portrait
// (delete its file first), keeping every other image stable. Reviewed
// rejects from the 2026-10-06 full-library contact-sheet pass.
const SEED_BUMPS = /** @type {Record<string, number>} */ ({
	anime_man_merchant_stern_noobai: 1, // rendered a cheerful pink-haired girl under man/stern tags
	anime_monster_bandit_illustrious: 2, // first reroll came back as a literal cat
	anime_monster_bandit_noobai: 1, // abstract orange spiral face
	anime_monster_troll_noobai: 1, // flat cartoon style clashes with the set
	anime_monster_wolf_illustrious: 1 // anthro royal-cap wolf, not a dire wolf
});

// --- helpers ----------------------------------------------------------------

function hashSeed(stem) {
	const salt = SEED_BUMPS[stem] ? `#${SEED_BUMPS[stem]}` : '';
	let h = 2166136261;
	for (const ch of stem + salt) h = (Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0) >>> 0;
	return h % 2147483647;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function buildWorkflow({ checkpoint, positive, negative, seed }) {
	return {
		1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
		2: { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
		3: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
		4: { class_type: 'EmptyLatentImage', inputs: { width: 832, height: 1216, batch_size: 1 } },
		5: {
			class_type: 'KSampler',
			inputs: {
				seed,
				steps: 26,
				cfg: 6,
				sampler_name: 'dpmpp_2m',
				scheduler: 'karras',
				denoise: 1,
				model: ['1', 0],
				positive: ['2', 0],
				negative: ['3', 0],
				latent_image: ['4', 0]
			}
		},
		6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
		7: { class_type: 'SaveImage', inputs: { filename_prefix: 'gate_portrait', images: ['6', 0] } }
	};
}

function loadManifest() {
	try {
		return JSON.parse(readFileSync(MANIFEST, 'utf8'));
	} catch {
		return { $comment: '', portraits: [] };
	}
}

function saveManifest(manifest) {
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, '\t') + '\n');
}

async function comfyFetch(path, options) {
	const res = await fetch(`${COMFY}${path}`, options);
	if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
	return res;
}

async function waitForComfy() {
	for (let i = 0; i < 120; i++) {
		try {
			await comfyFetch('/system_stats');
			return;
		} catch {
			await sleep(3000);
		}
	}
	throw new Error('ComfyUI never came up on ' + COMFY);
}

async function listCheckpoints() {
	const res = await comfyFetch('/object_info/CheckpointLoaderSimple');
	const data = await res.json();
	return data.CheckpointLoaderSimple.input.required.ckpt_name[0];
}

async function generateOne({ cp, stem, tags, subject, anchor }, manifest) {
	const file = `${stem}.png`;
	if (existsSync(resolve(OUT_DIR, file)) && manifest.portraits.some((p) => p.file === file)) {
		return 'skip';
	}

	const positive = anchor ? `solo, ${anchor}, ${STYLE}, ${subject}` : `solo, ${STYLE}, ${subject}`;
	const seed = hashSeed(stem);
	const clientId = `gate-${stem}`;
	const queue = await comfyFetch('/prompt', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			prompt: buildWorkflow({ checkpoint: cp.file, positive, negative: NEGATIVE, seed }),
			client_id: clientId
		})
	}).then((r) => r.json());
	const promptId = queue.prompt_id;

	// poll history (generation ≈ 5–20 s per image on this GPU)
	for (let i = 0; i < 200; i++) {
		await sleep(1500);
		const hist = await comfyFetch(`/history/${promptId}`).then((r) => r.json());
		const entry = hist[promptId];
		if (!entry) continue;
		if (entry.status?.status_str === 'error') throw new Error(`ComfyUI error on ${stem}`);
		const outputs = entry.outputs ?? {};
		const images = Object.values(outputs).flatMap((o) => o.images ?? []);
		const img = images[0];
		if (!img) continue;

		const bin = await comfyFetch(
			`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? '')}&type=${encodeURIComponent(img.type ?? 'output')}`
		).then((r) => r.arrayBuffer());
		writeFileSync(resolve(OUT_DIR, file), Buffer.from(bin));

		manifest.portraits = manifest.portraits.filter((p) => p.file !== file);
		manifest.portraits.push({
			file,
			bucket: cp.bucket,
			tags,
			settings: ['any'],
			source: `comfyui:${cp.file}`,
			license: 'locally-generated, user-owned',
			author: 'user (ComfyUI)'
		});
		saveManifest(manifest);
		return 'ok';
	}
	throw new Error(`timeout waiting for ${stem}`);
}

// --- main --------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

mkdirSync(OUT_DIR, { recursive: true });
const manifest = loadManifest();
manifest.$comment =
	'Character-portrait library (Docs/02 § Hero portraits). One entry per image: file (under static/assets/portraits/), bucket anime (realistic dropped by user review), tags describe the subject — heroes [age, role], personality variants [gender, role, expression], professions [gender, profession], monsters [monster, name], source checkpoint, license. Regenerate with scripts/generate-portraits.mjs against local ComfyUI.';

// The plan: heroes (72) + adult personality variants (72) + professions (24)
// + monsters (24) = 192 images across the two anime checkpoints.
const plan = [];
for (const cp of CHECKPOINTS) {
	for (const age of AGES) {
		for (const role of ROLES) {
			plan.push({
				cp,
				stem: `anime_${age[0]}_${role[0]}_${cp.short}`,
				tags: [age[0], role[0]],
				subject: `${age[1]}, ${role[1]}`,
				anchor: ageAnchor(age[0])
			});
		}
	}
	for (const gender of GENDERS) {
		for (const role of ROLES) {
			for (const expr of EXPRESSIONS) {
				plan.push({
					cp,
					stem: `anime_${gender[0]}_${role[0]}_${expr[0]}_${cp.short}`,
					tags: [gender[0], role[0], expr[0]],
					subject: `${gender[1]}, ${role[1]}, ${expr[1]}`,
					anchor: ageAnchor(gender[0])
				});
			}
		}
		for (const prof of PROFESSIONS) {
			plan.push({
				cp,
				stem: `anime_${gender[0]}_${prof[0]}_${cp.short}`,
				tags: [gender[0], prof[0]],
				subject: `${gender[1]}, ${prof[1]}`,
				anchor: ageAnchor(gender[0])
			});
		}
	}
	for (const monster of MONSTERS) {
		plan.push({
			cp,
			stem: `anime_monster_${monster[0]}_${cp.short}`,
			tags: ['monster', monster[0]],
			subject: `${MONSTER_STYLE}, ${monster[1]}`,
			anchor: null
		});
	}
}

if (dryRun) {
	console.log(`plan: ${plan.length} portraits`);
	for (const p of plan) console.log(` ${p.stem} [${p.tags.join(', ')}]`);
	process.exit(0);
}

await waitForComfy();
const available = new Set(await listCheckpoints());
for (const cp of CHECKPOINTS) {
	if (!available.has(cp.file)) throw new Error(`checkpoint not loaded in ComfyUI: ${cp.file}`);
}

let done = 0;
let skipped = 0;
for (const item of plan) {
	process.stdout.write(`[${done + skipped + 1}/${plan.length}] ${item.stem} … `);
	const result = await generateOne(item, manifest);
	if (result === 'skip') {
		skipped++;
		console.log('skip (exists)');
	} else {
		done++;
		console.log('ok');
	}
}
console.log(`\ndone: ${done} generated, ${skipped} skipped, manifest at ${MANIFEST}`);
