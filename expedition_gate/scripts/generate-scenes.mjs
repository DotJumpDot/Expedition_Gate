/**
 * Modern-scene art generator (มังฮวา/โลกสมัยใหม่ bucket).
 *
 * The 8 modern/manhwa presets + scifi currently share the 13 generic SVGs —
 * this batch gives them their own "modern" bucket: city/street/neon/gate/
 * crystal-dungeon scenes in the same anime style as the portrait library
 * (Illustrious-XL). Generation happens OFFLINE on the local ComfyUI
 * (Picture_Model, default http://127.0.0.1:8188) — never during GM turns.
 *
 * Usage (from expedition_gate/):
 *   node scripts/generate-scenes.mjs            # everything missing
 *   node scripts/generate-scenes.mjs --dry-run  # print the plan only
 *
 * Idempotent: existing files are skipped, the manifest is rewritten after
 * every image, so an interrupted run resumes cleanly.
 * Output: static/assets/scenes/modern-*.png (gitignored binaries) + entries
 * appended to assets/manifest.json (committed catalog, source "comfyui:…").
 * `npm run assets` skips comfyui-sourced entries — restore via this script.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const COMFY = process.env.COMFY_URL ?? 'http://127.0.0.1:8188';
const OUT_DIR = resolve('static/assets/scenes');
const MANIFEST = resolve('assets/manifest.json');

const CHECKPOINT = 'Illustrious-XL-v2.0.safetensors';

const STYLE =
	'masterpiece, best quality, anime background art, scenery, no humans, detailed environment, atmospheric lighting, cinematic composition, depth';

// Scenery has no 1girl/1boy anchor, so people-leaks are blocked negatively.
const NEGATIVE =
	'people, person, humans, crowd, 1girl, 1boy, silhouette of person, text, watermark, signature, logo, border, frame, multiple views, comic panel, split screen, blurry, lowres, jpeg artifacts, monochrome, greyscale, sketch, lineart, nsfw';

// tags MUST come from the SCENE_TAGS vocabulary (worldstate.ts zod enum) —
// the GM sets world.sceneTag, the picker matches manifest tags against it.
const SCENES = /** @type {const} */ ([
	[
		'modern-gate-plaza',
		['gate'],
		'giant glowing blue dimensional portal floating above a cracked city plaza at dusk, police barricades, abandoned evacuated square, drifting papers'
	],
	[
		'modern-city-day',
		['city'],
		'modern asian metropolis skyline in bright daylight, glass towers, elevated train line, clear sky'
	],
	[
		'modern-city-night',
		['city', 'night'],
		'modern asian megacity at night, dense neon signs, glowing skyscrapers, light trails between buildings'
	],
	[
		'modern-city-rain',
		['city', 'rain'],
		'modern city in heavy rain at night seen from a high vantage point, rain streaks, wet reflective streets below, dark storm clouds'
	],
	[
		'modern-street-day',
		['street'],
		'sunlit narrow asian city street, small shop fronts, hanging signs, tangled telephone wires, afternoon calm'
	],
	[
		'modern-street-night',
		['street', 'night'],
		'asian city street at night, glowing neon shop signs, vending machine light, wet pavement reflections'
	],
	[
		'modern-alley-night',
		['street', 'night'],
		'dark narrow back alley at night, flickering fluorescent lamp, steam rising from vents, scattered trash, distant neon glow'
	],
	[
		'modern-subway',
		['street', 'night'],
		'empty underground subway platform at night, tiled hall, rows of fluorescent lights, railway tracks, yellow safety line'
	],
	[
		'modern-market-night',
		['market', 'night'],
		'night market alley, food stalls with red lanterns, rising steam, hanging light bulbs, closed shutters in the distance'
	],
	[
		'modern-dungeon-crystal',
		['dungeon'],
		'vast underground cavern filled with giant glowing blue crystals, shafts of mystical light, fantasy dungeon interior'
	],
	[
		'modern-dungeon-corridor',
		['dungeon'],
		'ancient stone dungeon corridor, glowing magic runes on walls, mossy bricks, fantasy torchlight, darkness ahead'
	],
	[
		'modern-battle-street',
		['battle'],
		'city street after a monster battle, deep crater in the asphalt, scattered debris, rising smoke, bent lamppost, damaged storefronts'
	],
	[
		'modern-ruins-overpass',
		['ruins'],
		'collapsed highway overpass overtaken by vines and grass, rusted abandoned cars, dusky sky'
	],
	[
		'modern-rooftop-night',
		['night'],
		'rooftop of a tall building at night, water tower and antennas, sprawling city skyline with distant neon glow'
	],
	[
		'modern-river-bridge',
		['river', 'night'],
		'city river at night, long illuminated bridge spanning dark water, light reflections on ripples'
	],
	[
		'modern-void',
		['void'],
		'endless dark void with floating chunks of stone and a faint blue glow, surreal liminal space, drifting dust'
	]
]);

// Deterministic seeds per stem — bump to reroll one rejected scene
// (delete its file first); every other image stays stable.
const SEED_BUMPS = /** @type {Record<string, number>} */ ({});

function hashSeed(stem) {
	const salt = SEED_BUMPS[stem] ? `#${SEED_BUMPS[stem]}` : '';
	let h = 2166136261;
	for (const ch of stem + salt) h = (Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0) >>> 0;
	return h % 2147483647;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function buildWorkflow({ positive, seed }) {
	return {
		1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CHECKPOINT } },
		2: { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
		3: { class_type: 'CLIPTextEncode', inputs: { text: NEGATIVE, clip: ['1', 1] } },
		4: { class_type: 'EmptyLatentImage', inputs: { width: 1216, height: 832, batch_size: 1 } },
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
		7: { class_type: 'SaveImage', inputs: { filename_prefix: 'gate_scene', images: ['6', 0] } }
	};
}

function loadManifest() {
	try {
		return JSON.parse(readFileSync(MANIFEST, 'utf8'));
	} catch {
		return { $comment: '', images: [] };
	}
}

function saveManifest(manifest) {
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, '\t') + '\n');
}

async function comfyFetch(pathname, options) {
	const res = await fetch(`${COMFY}${pathname}`, options);
	if (!res.ok) throw new Error(`${pathname} → HTTP ${res.status}`);
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

async function generateOne({ stem, tags, subject }, manifest) {
	const file = `${stem}.png`;
	if (existsSync(resolve(OUT_DIR, file)) && manifest.images.some((e) => e.file === file)) {
		return 'skip';
	}

	const positive = `${STYLE}, ${subject}`;
	const seed = hashSeed(stem);
	const queue = await comfyFetch('/prompt', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			prompt: buildWorkflow({ positive, seed }),
			client_id: `gate-scene-${stem}`
		})
	}).then((r) => r.json());
	const promptId = queue.prompt_id;

	for (let i = 0; i < 200; i++) {
		await sleep(1500);
		const hist = await comfyFetch(`/history/${promptId}`).then((r) => r.json());
		const entry = hist[promptId];
		if (!entry) continue;
		if (entry.status?.status_str === 'error') throw new Error(`ComfyUI error on ${stem}`);
		const images = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? []);
		const img = images[0];
		if (!img) continue;

		const bin = await comfyFetch(
			`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? '')}&type=${encodeURIComponent(img.type ?? 'output')}`
		).then((r) => r.arrayBuffer());
		writeFileSync(resolve(OUT_DIR, file), Buffer.from(bin));

		manifest.images = manifest.images.filter((e) => e.file !== file);
		manifest.images.push({
			file,
			tags: [...tags],
			setting: ['modern'],
			source: `comfyui:${CHECKPOINT}`,
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

if (dryRun) {
	console.log(`plan: ${SCENES.length} scenes (${CHECKPOINT})`);
	for (const [stem, tags] of SCENES) console.log(` ${stem} [${tags.join(', ')}]`);
	process.exit(0);
}

await waitForComfy();
const available = new Set(await listCheckpoints());
if (!available.has(CHECKPOINT)) throw new Error(`checkpoint not loaded in ComfyUI: ${CHECKPOINT}`);

const manifest = loadManifest();
let done = 0;
let skipped = 0;
for (const [stem, tags, subject] of SCENES) {
	process.stdout.write(`[${done + skipped + 1}/${SCENES.length}] ${stem} … `);
	const result = await generateOne({ stem, tags: [...tags], subject }, manifest);
	if (result === 'skip') {
		skipped++;
		console.log('skip (exists)');
	} else {
		done++;
		console.log('ok');
	}
}
console.log(`\ndone: ${done} generated, ${skipped} skipped, manifest at ${MANIFEST}`);
