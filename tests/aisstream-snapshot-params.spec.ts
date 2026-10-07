import { expect, test } from '@playwright/test';
import { parseSnapshotParams } from '../src/lib/aisstream/snapshot-params';

test('defaults missing snapshot parameters to 15 seconds without class B', () => {
  expect(parseSnapshotParams(new URLSearchParams())).toEqual({
    windowSeconds: 15,
    includeClassB: false,
  });
});

test('accepts each configured window and an explicit class B choice', () => {
  for (const windowSeconds of [15, 30, 60, 120, 180, 240, 300]) {
    expect(parseSnapshotParams(new URLSearchParams({ window: String(windowSeconds), classB: '1' }))).toEqual({
      windowSeconds,
      includeClassB: true,
    });
  }
});

test('rejects invalid, repeated, or non-canonical snapshot parameters', () => {
  for (const query of [
    'window=14',
    'window=16',
    'window=99999',
    'window=abc',
    'window=',
    'window=015',
    'classB=2',
    'window=15&window=30',
    'classB=0&classB=1',
  ]) {
    expect(parseSnapshotParams(new URLSearchParams(query)), query).toBeNull();
  }
});

test('ignores unrelated query parameters', () => {
  expect(parseSnapshotParams(new URLSearchParams('extra=ignored'))).toEqual({
    windowSeconds: 15,
    includeClassB: false,
  });
});
