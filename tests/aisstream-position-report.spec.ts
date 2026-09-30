import { expect, test } from '@playwright/test';
import sample from '../data/samples/position-report.sample.json';
import { convertPositionReport } from '../src/lib/aisstream/position-report';

function copySample(): Record<string, unknown> {
  return structuredClone(sample) as Record<string, unknown>;
}

function nestedSample(): {
  MetaData: Record<string, unknown>;
  Message: { PositionReport: Record<string, unknown> };
} {
  return copySample() as {
    MetaData: Record<string, unknown>;
    Message: { PositionReport: Record<string, unknown> };
  };
}

test('converts the documented PositionReport sample to the shared Vessel shape', () => {
  expect(convertPositionReport(sample)).toEqual({
    id: '000000000',
    name: 'Synthetic Sample Vessel',
    lat: 51.05,
    lon: 1.42,
    speedKnots: 12.3,
    courseDeg: 135.2,
    timestamp: '2024-01-01T12:00:00.123Z',
    source: 'aisstream',
  });
});

test('trims a vessel name and maps an empty name to null', () => {
  const withPaddedName = nestedSample();
  withPaddedName.MetaData.ShipName = '  Sample Vessel  ';
  expect(convertPositionReport(withPaddedName)?.name).toBe('Sample Vessel');

  withPaddedName.MetaData.ShipName = '   ';
  expect(convertPositionReport(withPaddedName)?.name).toBeNull();
});

test('rejects empty MMSI and unparseable timestamps', () => {
  const missingId = nestedSample();
  missingId.MetaData.MMSI = '   ';
  expect(convertPositionReport(missingId)).toBeNull();

  const badTime = nestedSample();
  badTime.MetaData.time_utc = 'not a timestamp';
  expect(convertPositionReport(badTime)).toBeNull();
});

test('rejects unavailable, nonnumeric, or out-of-range positions', () => {
  const invalidLatitudes: unknown[] = [91, -91, Number.NaN, '51.05'];
  for (const latitude of invalidLatitudes) {
    const input = nestedSample();
    input.Message.PositionReport.Latitude = latitude;
    expect(convertPositionReport(input)).toBeNull();
  }

  const invalidLongitudes: unknown[] = [181, -181, Number.NaN, '1.42'];
  for (const longitude of invalidLongitudes) {
    const input = nestedSample();
    input.Message.PositionReport.Longitude = longitude;
    expect(convertPositionReport(input)).toBeNull();
  }
});

test('keeps a valid position while normalizing invalid speed and course to null', () => {
  const input = nestedSample();
  input.Message.PositionReport.Sog = 102.3;
  input.Message.PositionReport.Cog = 360;

  expect(convertPositionReport(input)).toMatchObject({
    lat: 51.05,
    lon: 1.42,
    speedKnots: null,
    courseDeg: null,
  });
});

test('preserves zero speed and course as valid values', () => {
  const input = nestedSample();
  input.Message.PositionReport.Sog = 0;
  input.Message.PositionReport.Cog = 0;

  expect(convertPositionReport(input)).toMatchObject({
    speedKnots: 0,
    courseDeg: 0,
  });
});
