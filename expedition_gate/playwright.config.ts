import { defineConfig } from '@playwright/test';

/**
 * Playwright e2e against the fake-llama stub — NEVER the live 8080.
 * The dev server gets an isolated campaign DB so tests never touch real data.
 */
export default defineConfig({
	testDir: 'tests/e2e',
	timeout: 120_000,
	retries: 0,
	use: {
		baseURL: 'http://localhost:5173',
		viewport: { width: 1280, height: 800 }
	},
	webServer: [
		{
			command: 'npm run fake-llama',
			port: 8090,
			reuseExistingServer: true,
			timeout: 30_000
		},
		{
			command: 'npm run dev',
			port: 5173,
			reuseExistingServer: true,
			timeout: 120_000,
			env: {
				LLAMA_URL: 'http://127.0.0.1:8090/v1',
				GATE_DB_PATH: 'data/gate.e2e.db'
			}
		}
	]
});
