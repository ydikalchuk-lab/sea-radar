import type { Vessel } from '@/types/vessel';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? ([+-])(\d{2})(\d{2}) UTC$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText = '', sign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59
  ) {
    return null;
  }

  const milliseconds = fractionText.slice(0, 3).padEnd(3, '0');
  const timezone = `${sign}${offsetHourText}:${offsetMinuteText}`;
  const iso = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}.${milliseconds}${timezone}`;
  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toVesselId(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function toName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function toPosition(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function toSpeed(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 102.2
    ? value
    : null;
}

function toCourse(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360
    ? value
    : null;
}

export function convertPositionReport(raw: unknown): Vessel | null {
  const message = record(raw);
  const metadata = record(message?.MetaData);
  const payload = record(message?.Message);
  const positionReport = record(
    message?.MessageType === 'StandardClassBPositionReport'
      ? payload?.StandardClassBPositionReport
      : payload?.PositionReport,
  );
  if (!metadata || !positionReport) return null;

  const id = toVesselId(metadata.MMSI);
  const timestamp = parseTimestamp(metadata.time_utc);
  const lat = toPosition(positionReport.Latitude, -90, 90);
  const lon = toPosition(positionReport.Longitude, -180, 180);
  if (id === null || timestamp === null || lat === null || lon === null) return null;

  return {
    id,
    name: toName(metadata.ShipName),
    lat,
    lon,
    speedKnots: toSpeed(positionReport.Sog),
    courseDeg: toCourse(positionReport.Cog),
    timestamp,
    source: 'aisstream',
  };
}
