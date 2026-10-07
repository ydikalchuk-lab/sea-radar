import { SNAPSHOT_WINDOW_OPTIONS } from '@/config/app';

export type SnapshotParams = {
  windowSeconds: (typeof SNAPSHOT_WINDOW_OPTIONS)[number];
  includeClassB: boolean;
};

export function parseSnapshotParams(searchParams: URLSearchParams): SnapshotParams | null {
  const windows = searchParams.getAll('window');
  const classBValues = searchParams.getAll('classB');
  if (windows.length > 1 || classBValues.length > 1) return null;

  const rawWindow = windows[0] ?? String(SNAPSHOT_WINDOW_OPTIONS[0]);
  const windowSeconds = SNAPSHOT_WINDOW_OPTIONS.find((option) => String(option) === rawWindow);
  if (windowSeconds === undefined) return null;

  const rawClassB = classBValues[0] ?? '0';
  if (rawClassB !== '0' && rawClassB !== '1') return null;

  return { windowSeconds, includeClassB: rawClassB === '1' };
}
