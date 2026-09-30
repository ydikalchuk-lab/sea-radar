import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

test('updates the selected card when switching from demo-1 to demo-3', async ({ page }) => {
  await page.goto('/');

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await page.locator('[data-vessel-id="demo-1"]').click();
  await expect(card.getByText('demo-1')).toBeVisible();
  await expect(card.getByText('Демо-судно 1')).toBeVisible();

  await page.locator('[data-vessel-id="demo-3"]').click();
  await expect(card.getByText('demo-3')).toBeVisible();
  await expect(card.getByText('Демо-судно 3')).toBeVisible();
  await expect(card.getByText('demo-1')).toHaveCount(0);
});

test('renders exactly three demo vessel markers', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
});

test('keeps the selected demo-2 card after repeated and map-background clicks', async ({ page }) => {
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-2"]');
  await marker.click();

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();
  await expect(card.getByText('demo-2')).toBeVisible();

  await marker.click();
  await expect(card).toBeVisible();
  await page.locator('[data-testid="map"]').click({ position: { x: 120, y: 120 } });
  await expect(card.getByText('demo-2')).toBeVisible();
});
