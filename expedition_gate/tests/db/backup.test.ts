// @vitest-environment node
// Backup touches the real sqlite client (fs + better-sqlite3) — node env.
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backupDbOnce, KEEP_BACKUPS } from '$lib/server/db/backup';
import { getDb } from '$lib/server/db/client';

let workdir: string;
let prevPath: string | undefined;

beforeAll(() => {
	workdir = mkdtempSync(join(tmpdir(), 'gate-backup-'));
	prevPath = process.env.GATE_DB_PATH;
	// Isolated DB per worker — must be set BEFORE the first getDb() call.
	process.env.GATE_DB_PATH = join(workdir, 'gate.db');
});

afterAll(() => {
	if (prevPath === undefined) delete process.env.GATE_DB_PATH;
	else process.env.GATE_DB_PATH = prevPath;
});

describe('backupDbOnce', () => {
	it('creates a snapshot of the campaign db (force)', async () => {
		getDb().$client.exec('create table if not exists t (x)'); // ensure the file exists
		const dest = await backupDbOnce(true);
		expect(dest).toBeTruthy();
		expect(existsSync(dest as string)).toBe(true);
		expect(dest).toContain('backups');
	});

	it('throttles without force (30-min window)', async () => {
		const again = await backupDbOnce(false);
		expect(again).toBeNull();
	});

	it('keeps only the newest files (retention cap)', async () => {
		const dir = resolve(process.env.GATE_DB_PATH as string, '..', 'backups');
		mkdirSync(dir, { recursive: true });
		for (let i = 0; i < KEEP_BACKUPS + 4; i++) {
			writeFileSync(join(dir, `gate-2050-01-01T00-00-${String(i).padStart(2, '0')}.db`), 'old');
		}
		await backupDbOnce(true);
		const files = readdirSync(dir).filter((name) => name.endsWith('.db'));
		expect(files.length).toBeLessThanOrEqual(KEEP_BACKUPS);
		// the newest real snapshot survives, the oldest fakes were pruned
		expect(files.some((name) => name.startsWith('gate-2050-01-01T00-00-00'))).toBe(false);
	});
});
