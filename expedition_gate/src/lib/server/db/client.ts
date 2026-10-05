/**
 * SQLite client — better-sqlite3 (sync) + Drizzle, WAL mode.
 * The database file lives at data/gate.db (gitignored); tests point
 * GATE_DB_PATH elsewhere (temp file or ':memory:').
 */
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

function dbPath(): string {
	const raw = process.env.GATE_DB_PATH?.trim() || 'data/gate.db';
	if (raw === ':memory:') return raw;
	return isAbsolute(raw) ? raw : resolve(raw);
}

function createDb() {
	const path = dbPath();
	if (path !== ':memory:') {
		mkdirSync(resolve(path, '..'), { recursive: true });
	}
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	return drizzle(sqlite, { schema });
}

const globalStore = globalThis as unknown as { __gateDb?: Db; __gateDbMigrated?: boolean };

/**
 * Singleton connection (survives dev-server HMR via globalThis).
 * Migrations from the checked-in `drizzle/` folder run once per process.
 */
export function getDb(): Db {
	if (!globalStore.__gateDb) {
		globalStore.__gateDb = createDb();
	}
	if (!globalStore.__gateDbMigrated) {
		migrate(globalStore.__gateDb, { migrationsFolder: resolve('drizzle') });
		globalStore.__gateDbMigrated = true;
	}
	return globalStore.__gateDb;
}

/** Test helper: fresh isolated DB (caller manages lifetime). */
export function createTestDb(): Db {
	const prev = process.env.GATE_DB_PATH;
	process.env.GATE_DB_PATH = ':memory:';
	const db = createDb();
	migrate(db, { migrationsFolder: resolve('drizzle') });
	process.env.GATE_DB_PATH = prev;
	return db;
}
