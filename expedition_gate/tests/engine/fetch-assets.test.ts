// @vitest-environment node
import { describe, expect, it } from 'vitest';

// Importing the script's guard (script main() only runs as CLI).
const { assertSafeAssetUrl } = await import('../../scripts/fetch-assets.mjs');

describe('fetch-assets URL guard (golden rule #7)', () => {
	it('accepts http/https public IP literals without DNS', async () => {
		await expect(assertSafeAssetUrl('https://93.184.216.34/art.png')).resolves.toBeTruthy();
		await expect(
			assertSafeAssetUrl('http://opengameart.org/sites/default/files/x.png')
		).resolves.toBeTruthy();
	});

	it('rejects non-http schemes', async () => {
		await expect(assertSafeAssetUrl('ftp://example.com/x.png')).rejects.toThrow(/http\/https/);
		await expect(assertSafeAssetUrl('file:///etc/passwd')).rejects.toThrow();
	});

	it('rejects loopback and localhost hostnames', async () => {
		await expect(assertSafeAssetUrl('http://localhost:8080/x.png')).rejects.toThrow(/ภายใน/);
		await expect(assertSafeAssetUrl('http://127.0.0.1/x.png')).rejects.toThrow(/ภายใน|สงวน/);
		await expect(assertSafeAssetUrl('http://myserver.local/x.png')).rejects.toThrow(/ภายใน/);
	});

	it('rejects private/reserved ranges — literal and via hostname shape', async () => {
		for (const url of [
			'http://10.0.0.5/x.png',
			'http://192.168.1.35/x.png',
			'http://172.16.0.9/x.png',
			'http://172.31.255.1/x.png',
			'http://169.254.1.1/x.png',
			'http://0.0.0.0/x.png',
			'http://[::1]/x.png',
			'http://100.64.1.1/x.png' // CGNAT
		]) {
			await expect(assertSafeAssetUrl(url), url).rejects.toThrow();
		}
	});

	it('rejects URLs with credentials', async () => {
		await expect(assertSafeAssetUrl('https://user:pass@example.com/x.png')).rejects.toThrow(
			/ล็อกอิน/
		);
	});
});
