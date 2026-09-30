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

test('clears demo selection and disables the button during a snapshot request', async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route('**/api/snapshot', async (route) => {
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot([])),
    });
  });

  await page.goto('/');
  const button = page.getByRole('button', { name: 'Завантажити справжні позиції' });
  await expect(button).toBeVisible();
  await expect(page.getByText('Демонстраційні дані')).toBeVisible();
  await page.locator('[data-vessel-id="demo-1"]').click();
  const card = page.getByRole('complementary', { name: 'Картка судна' });
  await expect(card).toBeVisible();

  try {
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.getByText('Завантаження…')).toBeVisible();
    await expect(page.locator('[data-vessel-id]')).toHaveCount(0);
    await expect(card).toHaveCount(0);
  } finally {
    releaseResponse();
  }

  await expect(page.getByText('За час збору позицій не отримано')).toBeVisible();
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

  await expect(page.getByText('AISStream · знімок за 15 с · отримано 12:34:56 UTC · суден: 0 · вибірка неповна')).toBeVisible();
  await expect(page.getByText('За час збору позицій не отримано')).toBeVisible();
  await expect(page.locator('[data-testid="map"]')).toHaveAttribute('data-view-reset-key', '0');
  await expect(page.getByText(/суден немає в районі/i)).toHaveCount(0);
  await expect(page.locator('[data-vessel-id]')).toHaveCount(0);
});

test('clears existing vessels and shows the fixed API error message', async ({ page }) => {
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

  await expect(page.getByText('Даних на карті немає')).toBeVisible();
  await expect(page.getByText('Не вдалося отримати дані: Ключ AISStream не налаштовано')).toBeVisible();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Картка судна' })).toHaveCount(0);
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

  await expect(page.getByText('Не вдалося отримати дані: Внутрішня помилка сервера')).toBeVisible();
  await expect(page.getByText('untrusted provider detail')).toHaveCount(0);
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

  await button.click();
  await expect(page.locator('[data-vessel-id]')).toHaveCount(1);
  await expect(page.locator('[data-vessel-id="211000001"]')).toHaveCount(0);
  await expect(page.locator('[data-vessel-id="211000002"]')).toBeVisible();
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

  await expect(page.locator('[data-vessel-id]')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Картка судна' })).toHaveCount(0);
  await expect(page.getByText('Даних на карті немає')).toBeVisible();
  await expect(page.getByText('Не вдалося отримати дані: Внутрішня помилка сервера')).toBeVisible();
});
