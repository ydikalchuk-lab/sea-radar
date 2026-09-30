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

test('renders one course-oriented demo vessel', async ({ page }) => {
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute('data-icon', 'course');
  await expect(page.getByText('Демонстраційні дані')).toBeVisible();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(1);
});

test('keeps the selected vessel card open after repeated and background clicks', async ({ page }) => {
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await marker.click();

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();
  await expect(card.getByText('demo-1')).toBeVisible();
  await expect(card.getByText('MV Dover Star')).toBeVisible();
  await expect(card.getByText('51.00000, 1.45000')).toBeVisible();
  await expect(card.getByText('12.5 kn')).toBeVisible();
  await expect(card.getByText('135°')).toBeVisible();
  await expect(card.getByText('12:00:00 UTC')).toBeVisible();
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
