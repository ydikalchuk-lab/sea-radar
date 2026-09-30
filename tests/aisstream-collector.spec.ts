import { expect, test } from '@playwright/test';
import sample from '../data/samples/position-report.sample.json';
import { collectSnapshot } from '../src/lib/aisstream/collector';
import type { SnapshotErrorCode } from '../src/lib/aisstream/errors';
import type { AisStreamHandle, AisStreamHandlers } from '../src/lib/aisstream/reader';
import type { Vessel } from '../src/types/vessel';

type SyntheticReport = {
  id: string;
  timeUtc: string;
  lat: number;
  lon: number;
  name: string | null;
  sog: number;
  cog: number;
};

function syntheticReport(overrides: SyntheticReport): unknown {
  const raw = structuredClone(sample) as {
    MetaData: Record<string, unknown>;
    Message: { PositionReport: Record<string, unknown> };
  };
  raw.MetaData.MMSI = overrides.id;
  raw.MetaData.ShipName = overrides.name;
  raw.MetaData.time_utc = overrides.timeUtc;
  raw.Message.PositionReport.Latitude = overrides.lat;
  raw.Message.PositionReport.Longitude = overrides.lon;
  raw.Message.PositionReport.Sog = overrides.sog;
  raw.Message.PositionReport.Cog = overrides.cog;
  return raw;
}

const reportA: SyntheticReport = {
  id: 'A',
  timeUtc: '2026-01-01 12:00:00 +0000 UTC',
  lat: 51.05,
  lon: 1.42,
  name: 'Synthetic A',
  sog: 12.3,
  cog: 135.2,
};

function createCollectorHarness() {
  let handlers: AisStreamHandlers | undefined;
  let clock = new Date('2026-01-01T12:00:00.000Z');
  let closeCalls = 0;
  let nextTimerId = 0;
  const timers = new Map<number, () => void>();
  const controller = new AbortController();
  const pending = collectSnapshot({
    apiKey: 'synthetic-test-only',
    signal: controller.signal,
    now: () => new Date(clock),
    setTimer: (callback) => {
      const id = ++nextTimerId;
      timers.set(id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (timer) => {
      timers.delete(timer as unknown as number);
    },
    openSource: (sourceHandlers) => {
      handlers = sourceHandlers;
      return {
        close: () => { closeCalls += 1; },
      } satisfies AisStreamHandle;
    },
  });

  return {
    pending,
    emit: (raw: unknown) => handlers?.onMessage(raw),
    ready: () => handlers?.onReady(),
    fail: (code: SnapshotErrorCode) => handlers?.onError(code),
    disconnect: () => handlers?.onClose(),
    expireWindow: () => {
      const [id, callback] = timers.entries().next().value ?? [];
      if (id !== undefined && callback) callback();
    },
    setNow: (iso: string) => { clock = new Date(iso); },
    abort: () => controller.abort(),
    closeCalls: () => closeCalls,
    pendingTimerCount: () => timers.size,
  };
}

test('synthetic duplicate messages for one vessel produce one object', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  harness.emit(syntheticReport(reportA));
  harness.emit(syntheticReport(reportA));
  harness.setNow('2026-01-01T12:00:15.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result.vessels).toEqual([{
    id: 'A',
    name: 'Synthetic A',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-01-01T12:00:00.000Z',
    source: 'aisstream',
  } satisfies Vessel]);
  expect(result.count).toBe(1);
});

test('synthetic older report arriving later leaves the newer position P2', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  harness.emit(syntheticReport({ ...reportA, timeUtc: '2026-01-01 12:01:00 +0000 UTC', lat: 51.06, lon: 1.43 }));
  harness.emit(syntheticReport({ ...reportA, timeUtc: '2026-01-01 12:00:00 +0000 UTC', lat: 51.05, lon: 1.42 }));
  harness.setNow('2026-01-01T12:00:15.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result.vessels).toEqual([{
    id: 'A',
    name: 'Synthetic A',
    lat: 51.06,
    lon: 1.43,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-01-01T12:01:00.000Z',
    source: 'aisstream',
  } satisfies Vessel]);
});

test('synthetic equal timestamps retain the first accepted position', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  harness.emit(syntheticReport(reportA));
  harness.emit(syntheticReport({ ...reportA, lat: 51.06, lon: 1.43 }));
  harness.setNow('2026-01-01T12:00:15.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result.vessels).toEqual([{
    id: 'A',
    name: 'Synthetic A',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-01-01T12:00:00.000Z',
    source: 'aisstream',
  } satisfies Vessel]);
});

test('synthetic one-millisecond newer timestamp replaces the earlier position', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  harness.emit(syntheticReport(reportA));
  harness.emit(syntheticReport({ ...reportA, timeUtc: '2026-01-01 12:00:00.001 +0000 UTC', lat: 51.06, lon: 1.43 }));
  harness.setNow('2026-01-01T12:00:15.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result.vessels).toEqual([{
    id: 'A',
    name: 'Synthetic A',
    lat: 51.06,
    lon: 1.43,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-01-01T12:00:00.001Z',
    source: 'aisstream',
  } satisfies Vessel]);
});

test('synthetic replacement uses the complete later vessel including null name', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  harness.emit(syntheticReport(reportA));
  harness.emit(syntheticReport({ ...reportA, timeUtc: '2026-01-01 12:01:00 +0000 UTC', lat: 51.06, lon: 1.43, name: null }));
  harness.setNow('2026-01-01T12:00:15.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result.vessels).toEqual([{
    id: 'A',
    name: null,
    lat: 51.06,
    lon: 1.43,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2026-01-01T12:01:00.000Z',
    source: 'aisstream',
  } satisfies Vessel]);
});

test('synthetic 100 unique vessels succeed at the cap and reject the 101st', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  for (let index = 0; index < 101; index += 1) {
    harness.emit(syntheticReport({
      ...reportA,
      id: `synthetic-${String(index).padStart(3, '0')}`,
    }));
  }

  const result = await harness.pending;
  expect(result).toMatchObject({
    count: 100,
    truncated: true,
    reason: 'limit_reached',
  });
  expect(result.vessels.map(({ id }) => id)).toContain('synthetic-000');
  expect(result.vessels.map(({ id }) => id)).toContain('synthetic-099');
  expect(result.vessels.map(({ id }) => id)).not.toContain('synthetic-100');
  expect(harness.closeCalls()).toBe(1);
  expect(harness.pendingTimerCount()).toBe(0);
});

test('synthetic 100 messages for one vessel continue until the window ends', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  for (let index = 0; index < 100; index += 1) {
    harness.emit(syntheticReport(reportA));
  }
  harness.setNow('2026-01-01T12:00:15.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result).toMatchObject({
    count: 1,
    truncated: false,
    reason: 'window_elapsed',
    collectedAt: '2026-01-01T12:00:15.000Z',
  });
});

test('synthetic collectedAt uses the injected clock at completion', async () => {
  const harness = createCollectorHarness();
  harness.ready();
  harness.setNow('2026-01-01T12:15:00.000Z');
  harness.expireWindow();

  const result = await harness.pending;
  expect(result).toMatchObject({
    vessels: [],
    collectedAt: '2026-01-01T12:15:00.000Z',
    windowSeconds: 15,
    count: 0,
    truncated: false,
    reason: 'window_elapsed',
  });
});
