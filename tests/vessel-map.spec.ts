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
