import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

test('moves selected demo vessel and card after controlled browser ticks', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T12:00:00.000Z') });
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await expect(marker).toBeVisible();
  await marker.click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();

  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 60_000);
  const coordinates = card.locator('dd').nth(2);
  const beforeCoordinates = await coordinates.textContent();
  const symbol = marker.locator('.vessel-marker-symbol');
  const beforeTransform = await symbol.getAttribute('style');

  await page.clock.runFor(6_000);

  await expect(card).toBeVisible();
  await expect(coordinates).not.toHaveText(beforeCoordinates ?? '');
  await expect(coordinates).toHaveText(/^\d{2}\.\d{5}, \d+\.\d{5}$/);
  await expect(symbol).not.toHaveAttribute('style', beforeTransform ?? '');
});

test('stops selected demo vessel at the final point after controlled time', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T12:00:00.000Z') });
  await page.goto('/');

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await expect(marker).toBeVisible();
  await marker.click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();

  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 60_000);
  const coordinates = card.locator('dd').nth(2);
  const speed = card.locator('dd').nth(3);
  const course = card.locator('dd').nth(4);
  const timestamp = card.locator('dd').nth(5);
  const initialCoordinates = await coordinates.textContent();
  const initialTimestamp = await timestamp.textContent();
  expect(initialCoordinates).not.toBe('51.10000, 1.65000');

  await page.clock.runFor(30_000);

  await expect(coordinates).toHaveText('51.10000, 1.65000');
  await expect(speed).toHaveText('0 kn');
  await expect(course).toHaveText('68°');
  await expect(timestamp).toHaveText(/^\d{2}:\d{2}:\d{2} UTC$/);
  const finalTimestamp = await timestamp.textContent();
  expect(finalTimestamp).not.toBe(initialTimestamp);
  const finalTransform = await marker.locator('.vessel-marker-symbol').getAttribute('style');

  await page.clock.runFor(6_000);

  await expect(coordinates).toHaveText('51.10000, 1.65000');
  await expect(speed).toHaveText('0 kn');
  await expect(course).toHaveText('68°');
  await expect(timestamp).toHaveText(finalTimestamp ?? '');
  await expect(marker.locator('.vessel-marker-symbol')).toHaveAttribute('style', finalTransform ?? '');
});
