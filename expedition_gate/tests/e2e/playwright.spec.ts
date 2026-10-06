import { expect, test } from '@playwright/test';

/**
 * Full-loop e2e on the fake llama: create world → hero → opening → 5 turns →
 * checkpoint → restore. Runs against the fake-llama stub (never live 8080).
 */

async function playTurn(page: import('@playwright/test').Page, text: string) {
	await page.getByLabel('คำสั่งของผู้เล่น').fill(text);
	await page.getByRole('button', { name: 'ส่ง' }).click();
	// The turn completes when a new set of choice chips (or the input) unlocks.
	await expect(page.getByLabel('คำสั่งของผู้เล่น')).toBeEnabled({ timeout: 30_000 });
}

test('create world → 5 turns → checkpoint → restore', async ({ page }) => {
	await page.goto('/', { waitUntil: 'networkidle' });

	// --- wizard page: world brief (stub answers instantly) — build-your-own mode
	await page.getByRole('link', { name: 'สร้างโลกใหม่', exact: true }).click();
	await expect(page).toHaveURL(/\/adventures\/new/);
	await page.getByRole('button', { name: 'สร้างโลก', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'ทุ่งประตูหิน' })).toBeVisible();
	await page.getByRole('button', { name: 'โลกนี้แล้ว — สร้างฮีโร่' }).click();

	// --- wizard: hero proposal
	await page.locator('#hero-name').fill('ตะวัน');
	await page.getByRole('button', { name: 'ให้ AI จัดค่าให้' }).click();
	await expect(page.getByText('ปูมหลัง')).toBeVisible();
	await expect(page.getByRole('button', { name: 'เริ่มการผจญภัย' })).toBeEnabled();
	await page.getByRole('button', { name: 'เริ่มการผจญภัย' }).click();

	// --- game screen: opening turn streams Thai narration
	await expect(page).toHaveURL(/\/campaign\//, { timeout: 15_000 });
	await expect(page.getByText('สายลมหนาว').first()).toBeVisible({ timeout: 30_000 });

	// --- five free turns
	for (let i = 1; i <= 5; i++) {
		await playTurn(page, `เทิร์นทดสอบที่ ${i} — เดินหน้า`);
	}
	// chips for the latest turn exist (stub suggestion fixture)
	await expect(page.getByText('ถามลุงหมึกว่าเห็นอะไรในคืนที่ลูกสาวหาย').first()).toBeVisible();

	// --- checkpoint: save with note
	await page.getByTitle('จุดบันทึก').click();
	await page.getByPlaceholder('บันทึกตอนนี้ไว้ว่า...').fill('ก่อนเข้าป่า e2e');
	await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
	await expect(page.getByText('ก่อนเข้าป่า e2e')).toBeVisible();

	// --- play past it, then restore
	await playTurn(page, 'เดินลึกเข้าป่าหลังจุดบันทึก');
	await page
		.getByText('สาขาก่อนย้อนเวลา (อัตโนมัติ)', { exact: false })
		.waitFor({
			state: 'detached',
			timeout: 1_000
		})
		.catch(() => {}); // optional: auto-snapshot appears only after a restore
	await page.getByRole('button', { name: 'ย้อนเวลา', exact: false }).first().click();
	await page.getByRole('button', { name: 'ยืนยันย้อน?' }).click();

	// after restore the page reloads session data; the checkpoint note persists
	await expect(page.getByText('ก่อนเข้าป่า e2e')).toBeVisible({ timeout: 15_000 });
	// the abandoned-branch auto snapshot now exists
	await expect(page.getByText('สาขาก่อนย้อนเวลา (อัตโนมัติ)')).toBeVisible({ timeout: 15_000 });

	// cleanup: close the checkpoint panel
	await page.getByRole('button', { name: 'จุดบันทึก' }).first().click();
});

test('mobile viewport: rail becomes a drawer', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/campaign/e2e-missing', { waitUntil: 'networkidle' });
	// Missing campaign redirects to the gate; use a fresh one instead.
	await page.goto('/', { waitUntil: 'networkidle' });
	await page.getByRole('link', { name: 'สร้างโลกใหม่', exact: true }).click();
	await expect(page).toHaveURL(/\/adventures\/new/);
	await page.getByRole('button', { name: 'สร้างโลก', exact: true }).click();
	await page.getByRole('button', { name: 'โลกนี้แล้ว — สร้างฮีโร่' }).click();
	await page.locator('#hero-name').fill('ค่ำ');
	await page.getByRole('button', { name: 'ให้ AI จัดค่าให้' }).click();
	await page.getByRole('button', { name: 'เริ่มการผจญภัย' }).click();
	await expect(page).toHaveURL(/\/campaign\//, { timeout: 15_000 });

	// Desktop rail hidden, drawer opens from the header on mobile
	const aside = page.locator('aside').first();
	await expect(aside).toBeHidden();
	await page.getByTitle('แผงฮีโร่', { exact: true }).click();
	const drawer = page.locator('aside.bg-popover');
	await expect(drawer).toBeVisible();
	await expect(drawer.getByText('ตัวละครที่พบ')).toBeVisible();
	await page.getByLabel('ปิดแผงฮีโร่').click({ force: true }); // scrim sits behind the drawer
});

test('เริ่มทันที: scenario → ready-made hero → opening streams (no AI generation)', async ({
	page
}) => {
	await page.goto('/', { waitUntil: 'networkidle' });

	// the gate shows scenario tiles — clicking one deep-links into the flow page
	await page.getByRole('link', { name: /ขุนนางแดนน้ำแข็ง/ }).click();
	await expect(page).toHaveURL(/\/adventures\/new\?scenario=frozen_north_noble/);
	await expect(page.getByText('สถานการณ์ของคุณ')).toBeVisible();
	await expect(page.getByText('พิธีรับรองทายาท').first()).toBeVisible();

	// pick the ready-made hero — jumps straight to the tweakable stat view
	await page.getByRole('button', { name: /เอเดริก เวลฮาร์ด/ }).click();
	await expect(page.getByText('ปูมหลัง')).toBeVisible();
	await expect(page.getByRole('button', { name: 'เริ่มการผจญภัย' })).toBeEnabled();
	await page.getByRole('button', { name: 'เริ่มการผจญภัย' }).click();

	// the opening narrates the AUTHORED situation (stub narrates it verbatim-ish)
	await expect(page).toHaveURL(/\/campaign\//, { timeout: 15_000 });
	await expect(page.getByText('เริ่มต้นการผจญภัย')).toBeVisible({ timeout: 30_000 });
	await playTurn(page, 'ลุกจากเตียงและมองหาฮัลวาร์');
});
