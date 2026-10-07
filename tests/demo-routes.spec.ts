import { expect, test } from '@playwright/test';
import { APP_CONFIG } from '../src/config/app';
import { DEMO_ROUTES } from '../src/data/demo-vessels';

const expectedRoutes = [
  { id: 'demo-1', speedKnots: 12.5 },
  { id: 'demo-2', speedKnots: 8.4 },
  { id: 'demo-3', speedKnots: 15.2 },
];

test('defines exactly three demo routes with their literal speeds', () => {
  expect(DEMO_ROUTES.map(({ id, speedKnots }) => ({ id, speedKnots }))).toEqual(expectedRoutes);
});

test('keeps demo-3 inside the offshore corridor across the strait', () => {
  const route = DEMO_ROUTES.find(({ id }) => id === 'demo-3');
  expect(route).toBeDefined();

  for (const point of route!.points) {
    expect(point.lat).toBeGreaterThanOrEqual(50.91);
    expect(point.lat).toBeLessThanOrEqual(50.98);
    expect(point.lon).toBeGreaterThanOrEqual(1.25);
    expect(point.lon).toBeLessThanOrEqual(1.6);
  }
});

test('keeps every route point inside the configured bounds', () => {
  const [[minLatitude, minLongitude], [maxLatitude, maxLongitude]] = APP_CONFIG.bounds;

  for (const route of DEMO_ROUTES) {
    expect(route.points.length).toBeGreaterThanOrEqual(8);
    expect(route.points.length).toBeLessThanOrEqual(12);
    expect(Number.isFinite(route.speedKnots)).toBe(true);

    for (const point of route.points) {
      expect(point.lat).toBeGreaterThanOrEqual(minLatitude);
      expect(point.lat).toBeLessThanOrEqual(maxLatitude);
      expect(point.lon).toBeGreaterThanOrEqual(minLongitude);
      expect(point.lon).toBeLessThanOrEqual(maxLongitude);
    }
  }
});
