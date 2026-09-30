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

test('synthetic missing and blank names become null', () => {
  const input = nestedSample();
  delete input.MetaData.ShipName;
  expect(convertPositionReport(input)?.name).toBeNull();

  input.MetaData.ShipName = '   ';
  expect(convertPositionReport(input)?.name).toBeNull();
});

test('synthetic invalid MMSI and timestamp reject the position', () => {
  const missingId = nestedSample();
  delete missingId.MetaData.MMSI;
  expect(convertPositionReport(missingId)).toBeNull();

  const emptyId = nestedSample();
  emptyId.MetaData.MMSI = '';
  expect(convertPositionReport(emptyId)).toBeNull();

  const blankId = nestedSample();
  blankId.MetaData.MMSI = '   ';
  expect(convertPositionReport(blankId)).toBeNull();

  const badTime = nestedSample();
  badTime.MetaData.time_utc = 'not a timestamp';
  expect(convertPositionReport(badTime)).toBeNull();
});

test('synthetic unavailable, nonnumeric, or out-of-range positions are rejected', () => {
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

test('synthetic speed 102.3 and course 360 become null', () => {
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

test('synthetic negative and missing speed become null', () => {
  const negative = nestedSample();
  negative.Message.PositionReport.Sog = -1;
  expect(convertPositionReport(negative)?.speedKnots).toBeNull();

  const missing = nestedSample();
  delete missing.Message.PositionReport.Sog;
  expect(convertPositionReport(missing)?.speedKnots).toBeNull();
});

test('synthetic zero speed and course remain valid', () => {
  const input = nestedSample();
  input.Message.PositionReport.Sog = 0;
  input.Message.PositionReport.Cog = 0;

  expect(convertPositionReport(input)).toMatchObject({
    speedKnots: 0,
    courseDeg: 0,
  });
});

test('synthetic malformed envelopes are rejected without throwing', () => {
  expect(convertPositionReport(null)).toBeNull();
  expect(convertPositionReport([])).toBeNull();

  const invalidPositionReport = nestedSample();
  invalidPositionReport.Message.PositionReport = [] as unknown as Record<string, unknown>;
  expect(convertPositionReport(invalidPositionReport)).toBeNull();
});

test('synthetic valid numeric limits remain unchanged', () => {
  const input = nestedSample();
  input.Message.PositionReport.Latitude = -90;
  input.Message.PositionReport.Longitude = -180;
  input.Message.PositionReport.Sog = 102.2;
  input.Message.PositionReport.Cog = 359.9;

  expect(convertPositionReport(input)).toMatchObject({
    lat: -90,
    lon: -180,
    speedKnots: 102.2,
    courseDeg: 359.9,
  });
});
