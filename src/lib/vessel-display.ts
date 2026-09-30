import type { Vessel } from '@/types/vessel';

export const NO_DATA_LABEL = 'Немає даних';

export function normalizeVesselName(name: string | null): string | null {
  return name === null || name.trim() === '' ? null : name;
}

export function formatCoordinates(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return NO_DATA_LABEL;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function formatSpeedKnots(speedKnots: number | null): string {
  if (speedKnots === null) return NO_DATA_LABEL;
  return `${speedKnots.toFixed(1).replace(/\.0$/, '')} kn`;
}

export function formatCourse(courseDeg: number | null): string {
  if (courseDeg === null) return NO_DATA_LABEL;
  return `${Math.round(courseDeg) % 360}°`;
}

export function formatTimestamp(timestamp: string | null): string {
  if (timestamp === null) return NO_DATA_LABEL;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return NO_DATA_LABEL;

  const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
  return `${time} UTC`;
}

export function formatSource(source: Vessel['source']): string {
  return source === 'demo' ? 'Демонстраційні дані' : 'AISStream';
}
