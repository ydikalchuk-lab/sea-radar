import { expect, test } from '@playwright/test';
import type { Vessel } from '../src/types/vessel';

const snapshot = (vessels: Vessel[], collectedAt = '2026-09-30T12:34:56.000Z', truncated = false) => ({
  ok: true,
  vessels,
  collectedAt,
  windowSeconds: 15,
  count: vessels.length,
  truncated,
  reason: truncated ? 'limit_reached' : 'window_elapsed',
});

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
});

test('keeps the demo visible and moving while a snapshot request is pending', async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route('**/api/snapshot', async (route) => {
    await responseGate;
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        attemptedAt: '2026-09-30T12:34:56.000Z',
        error: { code: 'connect_failed', message: 'ignored server message' },
      }),
    });
  });

  await page.clock.install({ time: new Date('2026-09-30T12:00:00.000Z') });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await expect(button).toBeVisible();
  await expect(page.locator('.demo-data-label')).toBeVisible();
  await page.locator('[data-vessel-id="demo-1"]').click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();
  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 60_000);
  const coordinates = card.locator('dd').nth(2);
  const beforeCoordinates = await coordinates.textContent();

  try {
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.getByText('Завантаження…')).toBeVisible();
    await expect(page.locator('[data-vessel-id="demo-1"]')).toBeVisible();
    await expect(card).toBeVisible();
    await page.clock.runFor(6_000);
    await expect(coordinates).not.toHaveText(beforeCoordinates ?? '');
  } finally {
    releaseResponse();
  }

  await expect(page.locator('.demo-data-label')).toHaveText('Демонстраційні дані');
  await expect(page.getByText('Спроба 12:34:56 UTC: не вдалося отримати дані: Не вдалося підключитися до джерела')).toBeVisible();
  await expect(button).toBeEnabled();
});

test('renders one returned AIS vessel in the existing marker and detail card', async ({ page }) => {
  const vessel: Vessel = {
    id: '211000001',
    name: 'Тестове судно',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(snapshot([vessel])),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();

  await expect(page.getByText('AISStream · знімок за 15 с · отримано 12:34:56 UTC · суден: 1 · вибірка неповна')).toBeVisible();
  await expect(page.getByText('Спроба 12:34:56 UTC: отримано суден: 1')).toBeVisible();
  const marker = page.locator('[data-vessel-id="211000001"]');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute('data-icon', 'course');
  await marker.click();

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card.getByText('211000001')).toBeVisible();
  await expect(card.getByText('Тестове судно')).toBeVisible();
  await expect(card.getByText('AISStream')).toBeVisible();
});

test('shows a successful empty collection without claiming the area has no vessels', async ({ page }) => {
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(snapshot([])),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();

  await expect(page.locator('.demo-data-label')).toBeVisible();
  await expect(page.getByText('Спроба 12:34:56 UTC: за час збору позицій не отримано')).toBeVisible();
  await expect(page.locator('[data-testid="map"]')).toHaveAttribute('data-view-reset-key', '0');
  await expect(page.getByText(/суден немає в районі/i)).toHaveCount(0);
  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
});

test('preserves the demo set and reports the timestamped API error', async ({ page }) => {
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: false,
      attemptedAt: '2026-09-30T12:34:56.000Z',
      error: { code: 'no_api_key', message: 'provider detail must never reach the interface' },
    }),
  }));

  await page.goto('/');
  await page.locator('[data-vessel-id="demo-2"]').click();
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();

  await expect(page.locator('.demo-data-label')).toBeVisible();
  await expect(page.getByText('Спроба 12:34:56 UTC: не вдалося отримати дані: Ключ AISStream не налаштовано')).toBeVisible();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
  await expect(page.getByRole('complementary', { name: 'Картка судна' })).toBeVisible();
});

test('uses fixed internal copy for an unrecognized API error code', async ({ page }) => {
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: false,
      attemptedAt: '2026-09-30T12:34:56.000Z',
      error: { code: 'unknown_code', message: 'untrusted provider detail' },
    }),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();

  await expect(page.getByText('Спроба 12:34:56 UTC: не вдалося отримати дані: Внутрішня помилка сервера')).toBeVisible();
  await expect(page.getByText('untrusted provider detail')).toHaveCount(0);
});

test('reports an unparseable response without a timestamp and preserves the displayed set', async ({ page }) => {
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: '',
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();

  await expect(page.locator('.demo-data-label')).toBeVisible();
  await expect(page.getByText('Спроба: не вдалося отримати дані: Немає відповіді сервера')).toBeVisible();
  await expect(page.locator('.snapshot-page-hint')).toHaveText('Після оновлення сторінки знову показуються демонстраційні дані');
  await expect(page.locator('.snapshot-panel > *')).toHaveText([
    'Завантажити справжні позиції',
    'Демонстраційні дані',
    'Спроба: не вдалося отримати дані: Немає відповіді сервера',
    'Після оновлення сторінки знову показуються демонстраційні дані',
  ]);
  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
});

test('keeps the last nonempty AIS snapshot and source label after a later error', async ({ page }) => {
  let requests = 0;
  const vessel: Vessel = {
    id: 'preserved-snapshot-vessel',
    name: 'Попереднє судно',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', (route) => {
    requests += 1;
    return route.fulfill(requests === 1 ? {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot([vessel], '2026-09-30T12:00:00.000Z')),
    } : {
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        attemptedAt: '2026-09-30T12:01:00.000Z',
        error: { code: 'connect_failed', message: 'ignored server message' },
      }),
    });
  });

  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await button.click();
  await expect(page.locator('[data-vessel-id="preserved-snapshot-vessel"]')).toBeVisible();
  await page.locator('[data-vessel-id="preserved-snapshot-vessel"]').click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();

  await button.click();

  await expect(page.getByText('AISStream · знімок за 15 с · отримано 12:00:00 UTC · суден: 1 · вибірка неповна')).toBeVisible();
  await expect(page.getByText('Спроба 12:01:00 UTC: не вдалося отримати дані: Не вдалося підключитися до джерела')).toBeVisible();
  await expect(page.locator('[data-vessel-id="preserved-snapshot-vessel"]')).toBeVisible();
  await expect(card).toBeVisible();
});

test('does not move a real snapshot when the browser clock advances', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-30T12:00:00.000Z') });
  const vessel: Vessel = {
    id: 'static-snapshot-vessel',
    name: 'Статичне судно',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-09-30T11:59:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(snapshot([vessel], '2026-09-30T12:00:00.000Z')),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();
  const marker = page.locator('[data-vessel-id="static-snapshot-vessel"]');
  await marker.click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  const coordinates = card.locator('dd').nth(2);
  const timestamp = card.locator('dd').nth(5);
  await expect(coordinates).toHaveText('51.05000, 1.42000');
  await expect(timestamp).toHaveText('11:59:00 UTC');

  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 60_000);
  await page.clock.runFor(30_000);

  await expect(coordinates).toHaveText('51.05000, 1.42000');
  await expect(timestamp).toHaveText('11:59:00 UTC');
});

test('keeps the previous AIS set and selected card while a repeat request is pending', async ({ page }) => {
  let releaseResponse!: () => void;
  let requests = 0;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  const vessel: Vessel = {
    id: 'pending-ais-vessel',
    name: 'AIS судно',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(snapshot([vessel], '2026-09-30T12:00:00.000Z')),
      });
      return;
    }
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot([])),
    });
  });

  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await button.click();
  const marker = page.locator('[data-vessel-id="pending-ais-vessel"]');
  await expect(marker).toBeVisible();
  await marker.click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();

  try {
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.getByText('Завантаження…')).toBeVisible();
    await expect(page.locator('.demo-data-label')).toHaveText('AISStream · знімок за 15 с · отримано 12:00:00 UTC · суден: 1 · вибірка неповна');
    await expect(marker).toBeVisible();
    await expect(card).toBeVisible();
  } finally {
    releaseResponse();
  }

  await expect(button).toBeEnabled();
  await expect(page.locator('.demo-data-label')).toHaveText('AISStream · знімок за 15 с · отримано 12:00:00 UTC · суден: 1 · вибірка неповна');
  await expect(page.getByText('Спроба 12:34:56 UTC: за час збору позицій не отримано')).toBeVisible();
  await expect(marker).toBeVisible();
  await expect(card).toBeVisible();
});

test('requests one initial-view reset for the first nonempty snapshot only', async ({ page }) => {
  let requests = 0;
  const makeVessel = (id: string): Vessel => ({
    id,
    name: 'Центральне судно',
    lat: 51.0,
    lon: 1.45,
    speedKnots: null,
    courseDeg: null,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  });
  await page.route('**/api/snapshot', (route) => {
    requests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot([makeVessel(`snapshot-${requests}`)])),
    });
  });

  await page.goto('/');
  const map = page.locator('[data-testid="map"]');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await button.click();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(1);
  await expect(map).toHaveAttribute('data-view-reset-key', '1');

  await button.click();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(1);
  await expect(map).toHaveAttribute('data-view-reset-key', '1');
});

test('preserves the panned map view after a later nonempty snapshot', async ({ page }) => {
  const vessel: Vessel = {
    id: 'map-view-vessel',
    name: 'Судно для карти',
    lat: 51.05,
    lon: 1.42,
    speedKnots: null,
    courseDeg: null,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(snapshot([vessel])),
  }));

  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await button.click();
  const marker = page.locator('[data-vessel-id="map-view-vessel"]');
  await expect(marker).toBeVisible();
  await expect(page.locator('[data-testid="map"]')).toHaveAttribute('data-view-reset-key', '1');
  const initialBox = await marker.boundingBox();
  const mapBox = await page.locator('[data-testid="map"]').boundingBox();
  if (!initialBox || !mapBox) throw new Error('Map and vessel marker must be measurable');

  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(mapBox.x + mapBox.width / 2 + 80, mapBox.y + mapBox.height / 2 + 20);
  await page.mouse.up();
  await page.mouse.wheel(0, 100);
  let previousBox: { x: number; y: number } | null = null;
  let stableSamples = 0;
  await expect.poll(async () => {
    const box = await marker.boundingBox();
    if (!box) return 0;
    if (previousBox?.x === box.x && previousBox.y === box.y) stableSamples += 1;
    else stableSamples = 0;
    previousBox = box;
    return stableSamples;
  }, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
  const pannedBox = await marker.boundingBox();
  if (!pannedBox) throw new Error('Panned vessel marker must be measurable');
  expect(pannedBox.x).not.toBe(initialBox.x);
  expect(pannedBox.y).not.toBe(initialBox.y);

  await button.click();
  await expect(marker).toBeVisible();
  const finalBoxes: { x: number; y: number }[] = [];
  let stableFinalSamples = 0;
  await expect.poll(async () => {
    const box = await marker.boundingBox();
    const previousBox = finalBoxes.at(-1);
    if (!box) {
      stableFinalSamples = 0;
      return stableFinalSamples;
    }
    if (previousBox?.x === box.x && previousBox.y === box.y) stableFinalSamples += 1;
    else stableFinalSamples = 0;
    finalBoxes.push(box);
    return stableFinalSamples;
  }, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
  const finalBox = finalBoxes.at(-1);
  if (!finalBox) throw new Error('Updated vessel marker must be measurable');
  expect(finalBox.x).toBe(pannedBox.x);
  expect(finalBox.y).toBe(pannedBox.y);
  await expect(page.locator('[data-testid="map"]')).toHaveAttribute('data-view-reset-key', '1');
});

test('refreshes the selected vessel card when its id remains in the new snapshot', async ({ page }) => {
  let requests = 0;
  const makeVessel = (lat: number, timestamp: string): Vessel => ({
    id: 'selected-refresh-vessel',
    name: 'Оновлене судно',
    lat,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp,
    source: 'aisstream',
  });
  await page.route('**/api/snapshot', (route) => {
    requests += 1;
    const vessel = requests === 1
      ? makeVessel(51.05, '2026-09-30T12:00:00.000Z')
      : makeVessel(51.07, '2026-09-30T12:01:00.000Z');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot([vessel], `2026-09-30T12:0${requests}:00.000Z`)),
    });
  });

  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await button.click();
  const marker = page.locator('[data-vessel-id="selected-refresh-vessel"]');
  await expect(marker).toBeVisible();
  await marker.click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  const coordinates = card.locator('dd').nth(2);
  const timestamp = card.locator('dd').nth(5);
  await expect(coordinates).toHaveText('51.05000, 1.42000');
  await expect(timestamp).toHaveText('12:00:00 UTC');

  await button.click();

  await expect(marker).toBeVisible();
  await expect(card).toBeVisible();
  await expect(coordinates).toHaveText('51.07000, 1.42000');
  await expect(timestamp).toHaveText('12:01:00 UTC');
});

test('replaces the previous snapshot on a later attempt and shows the limit suffix', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/snapshot', (route) => {
    requests += 1;
    const vessel: Vessel = {
      id: requests === 1 ? '211000001' : '211000002',
      name: `Snapshot vessel ${requests}`,
      lat: 51.05,
      lon: 1.42,
      speedKnots: null,
      courseDeg: null,
      timestamp: '2026-09-30T12:34:00.000Z',
      source: 'aisstream',
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot([vessel], '2026-09-30T12:34:56.000Z', requests === 2)),
    });
  });

  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await button.click();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(1);
  await expect(page.locator('[data-vessel-id="211000001"]')).toBeVisible();
  await page.locator('[data-vessel-id="211000001"]').click();
  await expect(page.getByRole('complementary', { name: 'Картка судна' })).toBeVisible();

  await button.click();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(1);
  await expect(page.locator('[data-vessel-id="211000001"]')).toHaveCount(0);
  await expect(page.locator('[data-vessel-id="211000002"]')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Картка судна' })).toHaveCount(0);
  await expect(page.getByText('AISStream · знімок за 15 с · отримано 12:34:56 UTC · суден: 1 · вибірка неповна · зупинено на ліміті 100')).toBeVisible();
});

test('renders null name, speed, and course as no data with a neutral icon', async ({ page }) => {
  const vessel: Vessel = {
    id: 'synthetic-null-fields',
    name: null,
    lat: 51.05,
    lon: 1.42,
    speedKnots: null,
    courseDeg: null,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(snapshot([vessel])),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();
  const marker = page.locator('[data-vessel-id="synthetic-null-fields"]');
  await expect(marker).toHaveAttribute('data-icon', 'neutral');
  await marker.click();

  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Немає даних')).toHaveCount(3);
});

test('fails closed on a synthetic inconsistent successful snapshot payload', async ({ page }) => {
  const vessel: Vessel = {
    id: 'synthetic-inconsistent-count',
    name: 'Synthetic vessel',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-09-30T12:34:00.000Z',
    source: 'aisstream',
  };
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ...snapshot([vessel]), count: 2 }),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Завантажити справжні позиції' }).click();

  await expect(page.locator('[data-vessel-id]')).toHaveCount(3);
  await expect(page.locator('.demo-data-label')).toBeVisible();
  await expect(page.getByText('Спроба: не вдалося отримати дані: Внутрішня помилка сервера')).toBeVisible();
});

test('keeps the snapshot panel compact and within a short mobile viewport', async ({ page }) => {
  await page.route('**/api/snapshot', (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: false,
      attemptedAt: '2026-09-30T12:34:56.000Z',
      error: { code: 'connect_failed', message: 'ignored server message' },
    }),
  }));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const panel = page.locator('.snapshot-panel');
  await page.locator('[data-vessel-id="demo-2"]').click();
  await expect(page.getByRole('complementary', { name: 'Картка судна' })).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBeLessThanOrEqual(360);

  await page.setViewportSize({ width: 320, height: 360 });
  const panelBox = await panel.boundingBox();
  const viewport = page.viewportSize();
  if (!panelBox || !viewport) throw new Error('Panel and viewport must be measurable');

  expect(panelBox.x).toBeGreaterThanOrEqual(16);
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width - 16);
  expect(panelBox.y).toBeGreaterThanOrEqual(16);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height - 16);
  await expect.poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test('distinguishes the selected vessel and gives its details a clear hierarchy', async ({ page }) => {
  await page.goto('/');
  const selectedMarker = page.locator('[data-vessel-id="demo-2"]');
  await selectedMarker.click();

  await expect(selectedMarker).toHaveCSS('border-top-width', '2px');
  await expect(page.locator('[data-vessel-id="demo-1"]')).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.snapshot-panel')).toHaveCSS('border-radius', '12px');
  await expect(page.locator('.snapshot-panel')).toHaveCSS('padding', '8px');
  await expect(page.getByRole('complementary', { name: 'Картка судна' }).locator('dd').first())
    .toHaveCSS('font-variant-numeric', 'tabular-nums');
});
