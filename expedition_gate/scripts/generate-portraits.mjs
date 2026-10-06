/**
 * Batch character-portrait generator (เริ่มที่ Hero portrait library).
 *
 * Drives the LOCAL ComfyUI API (Picture_Model, default http://127.0.0.1:8188)
 * to pre-generate the portrait library the game picks heroes from. Generation
 * happens OFFLINE (never during GM turns) — the GPU-contention rule from
 * Docs/02 stays intact.
 *
 * Matrix: 6 ages × 6 roles × 4 checkpoints = 144 portraits.
 *   anime     ← Illustrious-XL v2.0, NoobAI-XL v1.1
 *   realistic ← ArienMixXL v4.0 (Asian Portrait), Diving-Real-Asian v7
 * The two buckets NEVER mix inside one world — the app filters by bucket.
 *
 * Usage (from expedition_gate/):
 *   node scripts/generate-portraits.mjs            # everything missing
 *   node scripts/generate-portraits.mjs --only anime
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

const CHECKPOINTS = /** @type {const} */ ([
	{ file: 'Illustrious-XL-v2.0.safetensors', short: 'illustrious', bucket: 'anime' },
	{ file: 'NoobAI-XL v1.1 (Anime NSFW).safetensors', short: 'noobai', bucket: 'anime' },
	{ file: 'ArienMixXL v4.0 Asian Portrait (Realistic NSFW).safetensors', short: 'arien', bucket: 'realistic' },
	{ file: 'Diving-Real-Asian-v7.safetensors', short: 'diving', bucket: 'realistic' }
]);

const STYLE = /** @type {const} */ ({
	anime:
		'anime style character portrait, detailed face, clean line art, cel shading, fantasy character design sheet, upper body, facing viewer, masterpiece, best quality',
	realistic:
		'photorealistic portrait photograph, detailed face, natural skin texture, soft window light, dark plain backdrop, upper body shot, facing viewer, 85mm lens, sharp focus, high detail'
});

// SFW by design — the NSFW-capable checkpoints are steered away from it.
const NEGATIVE =
	'text, watermark, signature, logo, cropped, multiple people, extra limbs, deformed hands, bad anatomy, blurry, lowres, jpeg artifacts, nsfw, nude, child nudity';

// --- helpers ----------------------------------------------------------------

function hashSeed(stem) {
	let h = 2166136261;
	for (const ch of stem) h = (Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0) >>> 0;
	return h % 2147483647;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function buildWorkflow({ checkpoint, positive, negative, seed }) {
	return {
		'1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
		'2': { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
		'3': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
		'4': { class_type: 'EmptyLatentImage', inputs: { width: 832, height: 1216, batch_size: 1 } },
		'5': {
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
		'6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
		'7': { class_type: 'SaveImage', inputs: { filename_prefix: 'gate_portrait', images: ['6', 0] } }
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

async function generateOne({ cp, age, role }, manifest) {
	const stem = `${cp.bucket}_${age[0]}_${role[0]}_${cp.short}`;
	const file = `${stem}.png`;
	if (existsSync(resolve(OUT_DIR, file)) && manifest.portraits.some((p) => p.file === file)) {
		return 'skip';
	}

	const positive = `${STYLE[cp.bucket]}, ${age[1]}, ${role[1]}`;
	const seed = hashSeed(stem);
	const clientId = `gate-${stem}`;
	const queue = await comfyFetch('/prompt', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ prompt: buildWorkflow({ checkpoint: cp.file, positive, negative: NEGATIVE, seed }), client_id: clientId })
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
			tags: [age[0], role[0]],
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
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

mkdirSync(OUT_DIR, { recursive: true });
const manifest = loadManifest();
manifest.$comment =
	'Character-portrait library (Docs/02 § Hero portraits). One entry per image: file (under static/assets/portraits/), bucket anime|realistic (NEVER mixed inside one world — presets declare their style), tags [age, role], settings, source checkpoint, license. Regenerate with scripts/generate-portraits.mjs against local ComfyUI.';

const plan = [];
for (const cp of CHECKPOINTS) {
	if (only && cp.bucket !== only) continue;
	for (const age of AGES) for (const role of ROLES) plan.push({ cp, age, role });
}

if (dryRun) {
	console.log(`plan: ${plan.length} portraits`);
	for (const p of plan) console.log(` ${p.cp.bucket}/${p.age[0]}/${p.role[0]} ← ${p.cp.short}`);
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
	process.stdout.write(`[${done + skipped + 1}/${plan.length}] ${item.cp.bucket}/${item.age[0]}/${item.role[0]} … `);
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
