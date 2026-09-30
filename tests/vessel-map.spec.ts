import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

test('renders a visible map viewport', async ({ page }) => {
  await page.goto('/');

  const map = page.locator('[data-testid="map"]');
  await expect(map).toBeVisible();

  const bounds = await map.boundingBox();
  expect(bounds?.height ?? 0).toBeGreaterThan(0);
});

test('renders three course-oriented demo vessels', async ({ page }) => {
  await page.goto('/');

  const markers = page.locator('[data-vessel-id]');
  await expect(markers).toHaveCount(3);
  for (const [index, id] of ['demo-1', 'demo-2', 'demo-3'].entries()) {
    const marker = page.locator(`[data-vessel-id="${id}"]`);
    await expect(marker).toBeVisible();
    await expect(marker).toHaveAttribute('data-icon', 'course');
    await expect(marker).toHaveAccessibleName(`Демо-судно ${index + 1}`);
  }
  await expect(page.getByText('Демонстраційні дані')).toBeVisible();
});

test('keeps the selected vessel card open after repeated and background clicks', async ({ page }) => {
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await marker.click();

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();
  await expect(card.getByText('demo-1')).toBeVisible();
  await expect(card.getByText('Демо-судно 1')).toBeVisible();
  await expect(card.getByText('51.00000, 1.30000')).toBeVisible();
  await expect(card.getByText('12.5 kn')).toBeVisible();
  await expect(card.getByText('68°')).toBeVisible();
  await expect(card.getByText(/^\d{2}:\d{2}:\d{2} UTC$/)).toBeVisible();
  await expect(card.getByText('Демонстраційні дані')).toBeVisible();

  const sourceLabel = page.locator('.demo-data-label');
  const sourceBounds = await sourceLabel.boundingBox();
  const cardBounds = await card.boundingBox();
  expect(sourceBounds && cardBounds && sourceBounds.y + sourceBounds.height <= cardBounds.y).toBe(true);

  await marker.click();
  await expect(card).toBeVisible();
  await page.locator('[data-testid="map"]').click({ position: { x: 120, y: 120 } });
  await expect(card).toBeVisible();
  await expect(page.getByRole('button', { name: /close|закрити/i })).toHaveCount(0);
});
