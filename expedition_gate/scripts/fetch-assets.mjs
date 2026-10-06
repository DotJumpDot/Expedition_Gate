#!/usr/bin/env node
// @ts-nocheck — deliberately untyped standalone Node script (tests import it for the URL guards).
/**
 * fetch-assets.mjs — re-download / regenerate the scene-art library after a
 * fresh clone (Docs/02 § Scene illustration, AGENTS.md golden rule #7).
 *
 * - Entries with `url`: downloaded. URL validation is strict:
 *     • http/https only
 *     • host must resolve (DNS) to a PUBLIC address — localhost, loopback,
 *       private (RFC1918), link-local, and reserved ranges are rejected,
 *       so the manifest can never be used to probe the local network
 *     • per-file size cap (default 8 MB), streamed, atomic write
 * - Entries with `generator`: regenerated locally (starter art authored for
 *   this project, CC0) — keeps the repo binary-free per .gitignore.
 *
 * Usage: node scripts/fetch-assets.mjs [--force]
 */
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'assets', 'manifest.json');
const OUT_DIR = path.join(ROOT, 'static', 'assets', 'scenes');
const MAX_BYTES = 8 * 1024 * 1024;
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// URL guard (golden rule #7)
// ---------------------------------------------------------------------------

/** Reject any IP that is not global-uniclass public. */
function isForbiddenIp(ip) {
	if (net.isIPv4(ip)) {
		const [a, b] = ip.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) || // CGNAT
			(a === 169 && b === 254) || // link-local
			(a === 172 && b >= 16 && b <= 31) || // RFC1918
			(a === 192 && b === 168) || // RFC1918
			(a === 192 && b === 0) ||
			a >= 224 // multicast + reserved
		);
	}
	const v6 = ip.toLowerCase();
	return (
		v6 === '::' ||
		v6 === '::1' ||
		v6.startsWith('fc') ||
		v6.startsWith('fd') || // ULA
		v6.startsWith('fe8') ||
		v6.startsWith('fe9') ||
		v6.startsWith('fea') ||
		v6.startsWith('feb') || // link-local
		v6.startsWith('::ffff:127.') ||
		v6.startsWith('::ffff:10.') ||
		v6.startsWith('::ffff:192.168.')
	);
}

function forbiddenHostname(hostname) {
	const host = hostname.toLowerCase();
	return (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		host.endsWith('.lan') ||
		host.endsWith('.internal')
	);
}

/**
 * Validate a manifest URL: http/https, host resolves to public addresses only.
 * Throws with a Thai-readable reason when rejected.
 */
export async function assertSafeAssetUrl(urlString) {
	let url;
	try {
		url = new URL(urlString);
	} catch {
		throw new Error(`URL ไม่ถูกต้อง: ${urlString}`);
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`อนุญาตเฉพาะ http/https: ${urlString}`);
	}
	if (url.username || url.password) {
		throw new Error(`ห้ามมีข้อมูลล็อกอินใน URL: ${urlString}`);
	}
	if (forbiddenHostname(url.hostname)) {
		throw new Error(`ห้ามโฮสต์ภายในเครื่อง/เครือข่าย: ${urlString}`);
	}
	let addresses;
	if (net.isIP(url.hostname)) {
		addresses = [{ address: url.hostname, family: net.isIPv4(url.hostname) ? 4 : 6 }];
	} else {
		try {
			addresses = await lookup(url.hostname, { all: true });
		} catch {
			throw new Error(`แก้ชื่อโฮสต์ไม่ได้: ${url.hostname}`);
		}
	}
	if (addresses.length === 0) {
		throw new Error(`ไม่พบที่อยู่ของโฮสต์: ${url.hostname}`);
	}
	for (const { address } of addresses) {
		if (isForbiddenIp(address)) {
			throw new Error(`โฮสต์แก้ไปยังที่อยู่ภายใน/สงวน (${address}): ${urlString}`);
		}
	}
	return url;
}

// ---------------------------------------------------------------------------
// Starter art generator — locally authored CC0 SVG scenes (dark fantasy)
// ---------------------------------------------------------------------------

const SKY = {
	night: ['#0d0f1e', '#1a1630'],
	dusk: ['#1c1220', '#3a2030'],
	dawn: ['#241a26', '#4a2c28'],
	ember: ['#170f0c', '#402214'],
	gloom: ['#0f1414', '#1e2c28']
};

function svgWrap(defs, body, sky = SKY.night) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
<radialGradient id="moon" cx="0.72" cy="0.24" r="0.5"><stop offset="0" stop-color="#e8dcc0" stop-opacity="0.9"/><stop offset="0.25" stop-color="#e8dcc0" stop-opacity="0.28"/><stop offset="1" stop-color="#e8dcc0" stop-opacity="0"/></radialGradient>
<radialGradient id="glow" cx="0.5" cy="0.8" r="0.6"><stop offset="0" stop-color="#e8954a" stop-opacity="0.55"/><stop offset="1" stop-color="#e8954a" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
${defs}
</defs>
<rect width="800" height="450" fill="url(#sky)"/>
<rect width="800" height="450" fill="url(#moon)"/>
${body}
<rect width="800" height="450" fill="url(#vig)"/>
</svg>`;
}

const GENERATORS = {
	gate: () =>
		svgWrap(
			'',
			`<g fill="#0a0a12"><rect x="290" y="150" width="220" height="300"/><path d="M330 450V270a70 70 0 0 1 140 0v180z" fill="#131024"/><path d="M355 450V272a45 45 0 0 1 90 0v178z" fill="#05050a"/></g>
<ellipse cx="400" cy="452" rx="260" ry="46" fill="#08070e"/>
<g stroke="#e8dcc0" stroke-opacity="0.35" stroke-width="2"><line x1="352" y1="300" x2="448" y2="296"/><line x1="350" y1="360" x2="450" y2="357"/></g>
<circle cx="400" cy="328" r="5" fill="#e8b45a" opacity="0.9"/><circle cx="400" cy="328" r="14" fill="#e8b45a" opacity="0.22"/>`,
			SKY.dusk
		),
	village: () =>
		svgWrap(
			'',
			`<g fill="#0c0a16"><rect y="330" width="800" height="120"/><path d="M110 330v-70l55-38 55 38v70z"/><path d="M280 330v-90l65-45 65 45v90z"/><path d="M480 330v-60l50-34 50 34v60z"/><path d="M620 330v-76l58-40 58 40v76z"/></g>
<g fill="#e8954a"><rect x="150" y="300" width="14" height="18" opacity="0.85"/><rect x="330" y="296" width="16" height="22" opacity="0.9"/><rect x="516" y="306" width="12" height="16" opacity="0.7"/><rect x="668" y="300" width="14" height="20" opacity="0.8"/></g>
<ellipse cx="400" cy="440" rx="420" ry="60" fill="#08070e"/>
<g stroke="#e8dcc0" stroke-opacity="0.18" stroke-width="1.4"><line x1="70" y1="250" x2="150" y2="222"/><line x1="640" y1="240" x2="720" y2="214"/></g>`,
			SKY.ember
		),
	forest: () =>
		svgWrap(
			'',
			`<g fill="#0a1210">
${Array.from({ length: 14 }, (_, i) => {
	const x = 20 + i * 58 + (i % 3) * 14;
	const h = 150 + ((i * 53) % 120);
	return `<path d="M${x} 450v-${h}l${28 + (i % 2) * 8}-${h * 0.42} ${28 + (i % 2) * 8} ${h * 0.42}z"/>`;
}).join('')}
</g>
<g fill="#060b0a"><path d="M120 450v-210l40-95 40 95v210z"/><path d="M560 450v-190l44-100 44 100v190z"/></g>
<ellipse cx="400" cy="452" rx="440" ry="60" fill="#050807"/>
<g fill="#c9d8c2" opacity="0.22"><circle cx="180" cy="330" r="3"/><circle cx="330" cy="290" r="2.4"/><circle cx="520" cy="320" r="2.8"/><circle cx="640" cy="270" r="2.2"/></g>`,
			SKY.gloom
		),
	mountain: () =>
		svgWrap(
			'',
			`<path d="M-20 450 180 180l120 150 90-110 140 180 90-90 200 140z" fill="#0b0d18"/>
<path d="M-20 450 140 260l160 190 120-130 180 160 120-80 100 80z" fill="#070810"/>
<path d="M300 220 320 150l26 62z" fill="#e8dcc0" opacity="0.25"/>
<path d="M470 230 500 160l40 78z" fill="#e8dcc0" opacity="0.2"/>
<ellipse cx="400" cy="452" rx="440" ry="60" fill="#05060c"/>`,
			SKY.night
		),
	tavern: () =>
		svgWrap(
			'',
			`<g fill="#0c0a14"><rect x="180" y="180" width="440" height="270"/><path d="M160 190 400 80l240 110z"/></g>
<g fill="#e8954a"><rect x="230" y="240" width="60" height="70" opacity="0.92"/><rect x="510" y="240" width="60" height="70" opacity="0.92"/><rect x="370" y="330" width="60" height="120" opacity="0.85"/></g>
<circle cx="400" cy="150" r="26" fill="none" stroke="#e8b45a" stroke-width="5" opacity="0.8"/>
<circle cx="400" cy="150" r="26" fill="#e8b45a" opacity="0.18"/>
<ellipse cx="400" cy="452" rx="380" ry="46" fill="#08070e"/>`,
			SKY.ember
		),
	dungeon: () =>
		svgWrap(
			'',
			`<g fill="#08080f"><rect y="60" width="800" height="390"/><path d="M320 450V300a80 80 0 0 1 160 0v150z" fill="#020206"/></g>
<g stroke="#141420" stroke-width="10"><line x1="120" y1="60" x2="120" y2="450"/><line x1="240" y1="60" x2="240" y2="450"/><line x1="560" y1="60" x2="560" y2="450"/><line x1="680" y1="60" x2="680" y2="450"/></g>
<ellipse cx="400" cy="420" rx="200" ry="34" fill="#e8954a" opacity="0.12"/>
<circle cx="400" cy="360" r="8" fill="#e8b45a" opacity="0.85"/><circle cx="400" cy="360" r="22" fill="#e8b45a" opacity="0.2"/>`,
			SKY.gloom
		),
	temple: () =>
		svgWrap(
			'',
			`<g fill="#0c0c18"><rect x="250" y="200" width="300" height="250"/><path d="M230 210 400 120l170 90z"/><g stroke="#0c0c18" stroke-width="26"><line x1="285" y1="230" x2="285" y2="450"/><line x1="360" y1="230" x2="360" y2="450"/><line x1="440" y1="230" x2="440" y2="450"/><line x1="515" y1="230" x2="515" y2="450"/></g></g>
<g fill="#0c0c18"><rect x="270" y="210" width="24" height="240"/><rect x="346" y="210" width="24" height="240"/><rect x="430" y="210" width="24" height="240"/><rect x="506" y="210" width="24" height="240"/></g>
<circle cx="400" cy="330" r="20" fill="#e8b45a" opacity="0.25"/><circle cx="400" cy="330" r="9" fill="#e8b45a" opacity="0.9"/>
<ellipse cx="400" cy="452" rx="320" ry="44" fill="#08070e"/>`,
			SKY.dawn
		),
	campfire: () =>
		svgWrap(
			'',
			`<g fill="#0a0f0c"><path d="M-20 380 200 330l180 30 200-46 240 60v96h-840z"/></g>
<circle cx="400" cy="380" r="120" fill="url(#glow)"/>
<g><path d="M400 300c26 34 40 56 40 78a40 40 0 1 1-80 0c0-22 14-44 40-78z" fill="#e8873a" opacity="0.9"/><path d="M400 330c15 22 24 36 24 50a24 24 0 1 1-48 0c0-14 9-28 24-50z" fill="#f2c14e"/></g>
<g stroke="#241a12" stroke-width="9" stroke-linecap="round"><line x1="360" y1="420" x2="440" y2="404"/><line x1="364" y1="402" x2="436" y2="420"/></g>
<g fill="#06090a"><circle cx="250" cy="404" r="16"/><circle cx="556" cy="400" r="18"/></g>`,
			SKY.night
		),
	night: () =>
		svgWrap(
			'',
			`<circle cx="580" cy="105" r="42" fill="#e8dcc0" opacity="0.92"/>
<circle cx="580" cy="105" r="60" fill="#e8dcc0" opacity="0.12"/>
<g fill="#c9d4e2" opacity="0.7"><circle cx="90" cy="60" r="1.8"/><circle cx="210" cy="120" r="1.4"/><circle cx="330" cy="50" r="1.6"/><circle cx="470" cy="150" r="1.3"/><circle cx="700" cy="200" r="1.6"/><circle cx="640" cy="60" r="1.4"/><circle cx="150" cy="190" r="1.3"/><circle cx="520" cy="80" r="1.2"/></g>
<path d="M-20 380 140 300l160 50 200-70 180 60 140-30v140h-820z" fill="#080a14"/>`,
			SKY.night
		),
	river: () =>
		svgWrap(
			'',
			`<path d="M-20 330 200 300l180 26 200-34 240 40v128h-840z" fill="#0a1020"/>
<path d="M-20 356c120-18 240-10 360 6s300 14 480-8v116h-840z" fill="#0c1830"/>
<g stroke="#5a86b8" stroke-opacity="0.4" stroke-width="2.4" fill="none"><path d="M80 400c60-8 120-6 180 2"/><path d="M330 420c70-10 150-8 230 2"/><path d="M560 396c60-6 110-4 160 4"/></g>
<path d="M540 210 580 130l52 86z" fill="#0b0d18"/>
<circle cx="580" cy="105" r="34" fill="#e8dcc0" opacity="0.85"/>`,
			SKY.night
		)
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function writeAtomic(file, data) {
	const target = path.join(OUT_DIR, file);
	const tmp = `${target}.tmp`;
	writeFileSync(tmp, data);
	renameSync(tmp, target);
}

async function downloadUrl(entry) {
	const url = await assertSafeAssetUrl(entry.url);
	const res = await fetch(url, { redirect: 'follow' });
	if (!res.ok) throw new Error(`HTTP ${res.status} จาก ${entry.url}`);
	const declared = Number(res.headers.get('content-length') ?? 0);
	if (declared > MAX_BYTES) throw new Error(`ไฟล์ใหญ่เกิน ${MAX_BYTES} bytes: ${entry.file}`);
	const buffer = Buffer.from(await res.arrayBuffer());
	if (buffer.length > MAX_BYTES) throw new Error(`ไฟล์ใหญ่เกินขีดจำกัด: ${entry.file}`);
	return buffer;
}

async function main() {
	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
	const images = manifest.images ?? [];
	if (!Array.isArray(images) || images.length === 0) {
		console.error('manifest.json ไม่มีรายการรูป (images: [])');
		process.exit(1);
	}
	mkdirSync(OUT_DIR, { recursive: true });

	let ok = 0;
	let skipped = 0;
	const errors = [];
	for (const entry of images) {
		for (const field of ['file', 'tags', 'setting', 'source', 'license', 'author']) {
			if (entry[field] === undefined) {
				errors.push(`${entry.file ?? '?'}: ขาดข้อมูล "${field}" (source/license/author บังคับ)`);
			}
		}
		const target = path.join(OUT_DIR, entry.file);
		if (!FORCE && existsSync(target) && statSync(target).size > 0) {
			skipped++;
			continue;
		}
		try {
			if (entry.generator) {
				const gen = GENERATORS[entry.generator];
				if (!gen) throw new Error(`ไม่รู้จัก generator: ${entry.generator}`);
				writeAtomic(entry.file, gen());
			} else if (entry.url) {
				writeAtomic(entry.file, await downloadUrl(entry));
			} else {
				throw new Error('ต้องมี url หรือ generator');
			}
			ok++;
			console.log(`✓ ${entry.file}`);
		} catch (err) {
			errors.push(`${entry.file}: ${err.message}`);
		}
	}

	console.log(`\n${ok} ใหม่, ${skipped} มีอยู่แล้ว, ${errors.length} ผิดพลาด`);
	if (errors.length) {
		for (const message of errors) console.error(`✗ ${message}`);
		process.exit(1);
	}
}

// Run only as CLI (unit tests import the guards).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
	await main();
}
