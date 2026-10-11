/**
 * Throttled SQLite backup — data/gate.db is the only copy of months of play,
 * so every server start (and at most every 30 min while it runs) snapshots it
 * to data/backups/ keeping the newest KEEP_BACKUPS files. A backup failure is
 * logged, never thrown — this must not break the app.
 */
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { getDb } from './client';

export const BACKUP_DIR = 'data/backups';
export const BACKUP_MIN_INTERVAL_MS = 30 * 60 * 1000;
export const KEEP_BACKUPS = 10;

function backupDir(): string {
	const dbPath = process.env.GATE_DB_PATH?.trim() || 'data/gate.db';
	if (dbPath === ':memory:') return resolve(BACKUP_DIR);
	const base = isAbsolute(dbPath) ? dbPath : resolve(dbPath);
	return resolve(base, '..', 'backups');
}

export async function backupDbOnce(force = false): Promise<string | null> {
	try {
		const dir = backupDir();
		mkdirSync(dir, { recursive: true });
		const stamp = resolve(dir, '.last');
		if (!force) {
			try {
				if (Date.now() - statSync(stamp).mtimeMs < BACKUP_MIN_INTERVAL_MS) return null;
			} catch {
				// no stamp yet — first backup of this install
			}
		}
		const stampText = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const dest = resolve(dir, `gate-${stampText}.db`);
		await getDb().$client.backup(dest);
		writeFileSync(stamp, String(Date.now()));
		// Retention: keep the newest KEEP_BACKUPS .db files (name sort == time sort).
		const files = readdirSync(dir)
			.filter((name) => name.endsWith('.db'))
			.sort();
		for (const name of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
			try {
				unlinkSync(resolve(dir, name));
			} catch {
				// a vanished file is fine
			}
		}
		return dest;
	} catch (err) {
		console.error('[backup] snapshot failed:', err);
		return null;
	}
}
