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
  await expect(page.locator('.demo-data-label')).toHaveText('Демонстраційні дані');
});

test('keeps the selected vessel card open after repeated and background clicks', async ({ page }) => {
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await marker.click();

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();
  await expect(card.getByText('demo-1')).toBeVisible();
  await expect(card.getByText('Демо-судно 1')).toBeVisible();
  await expect(card.getByText(/^\d{2}\.\d{5}, \d+\.\d{5}$/)).toBeVisible();
  await expect(card.getByText(/^\d+(?:\.\d)? kn$/)).toBeVisible();
  await expect(card.getByText(/^\d{1,3}°$/)).toBeVisible();
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

test('keeps the map zoom controls clear of the snapshot panel', async ({ page }) => {
  await page.goto('/');

  const panel = page.locator('.snapshot-panel');
  const zoom = page.locator('.leaflet-control-zoom');
  await expect(zoom).toBeVisible();

  for (const viewport of [{ width: 1280, height: 720 }, { width: 320, height: 360 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const panelBox = await panel.boundingBox();
      const zoomBox = await zoom.boundingBox();
      if (!panelBox || !zoomBox) return false;

      return panelBox.x + panelBox.width <= zoomBox.x ||
        zoomBox.x + zoomBox.width <= panelBox.x ||
        panelBox.y + panelBox.height <= zoomBox.y ||
        zoomBox.y + zoomBox.height <= panelBox.y;
    }).toBe(true);
  }
});
