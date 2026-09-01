import { test, expect } from '@playwright/test';

test.describe('VINSS invisible-agent UX', () => {
  test('keeps room secret hidden until access details', async ({ page }) => {
    await page.goto('/#rooms');
    await page.getByPlaceholder(/Label lokal/).fill('OTC Demo');
    await page.getByRole('button', { name: 'Buat Room' }).click();
    await expect(page.getByText(/secret/i)).not.toBeVisible();
    await page.getByRole('link', { name: /Access details/ }).click();
    await expect(page.getByTestId('access-details')).toBeVisible();
  });

  test('shows transparent fee without making fee the primary UX', async ({ page }) => {
    await page.goto('/#rooms');
    await page.getByPlaceholder(/Label lokal/).fill('Fee Demo');
    await page.getByRole('button', { name: 'Buat Room' }).click();
    await page.locator('a[href^="/room/"]').first().click();
    await page.getByRole('button', { name: 'offer' }).click();
    await page.getByPlaceholder('Jumlah').fill('50000');
    await expect(page.getByTestId('fee-breakdown')).toContainText('Review total');
  });

  test('agent requires explicit context sharing', async ({ page }) => {
    await page.goto('/#rooms');
    await page.getByPlaceholder(/Label lokal/).fill('Agent Demo');
    await page.getByRole('button', { name: 'Buat Room' }).click();
    await page.locator('a[href^="/room/"]').first().click();
    await page.getByRole('button', { name: /Review deal/ }).click();
    const ask = page.getByRole('button', { name: 'Ask' });
    await expect(ask).toBeDisabled();
    await page.getByRole('checkbox', { name: /Share current deal context/ }).check();
    await page.getByPlaceholder('Analisa deal ini…').fill('Review this deal');
    await expect(ask).toBeEnabled();
  });
});
