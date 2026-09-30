'use client';

import { useEffect, useRef, useState } from 'react';
import { DEMO_ROUTES } from '@/data/demo-vessels';
import {
  AIS_SNAPSHOT_MAX_VESSELS,
  AIS_SNAPSHOT_WINDOW_MS,
  APP_CONFIG,
  DEMO_TICK_MS,
} from '@/config/app';
import { advanceDemoVessels, createInitialDemoState } from '@/lib/demo-motion';
import { formatTimestamp } from '@/lib/vessel-display';
import type { Vessel } from '@/types/vessel';
import VesselCard from './VesselCard';
import LeafletMap from './LeafletMap';

type SnapshotState =
  | { status: 'idle-demo' }
  | { status: 'loading' }
  | { status: 'success'; vessels: Vessel[]; collectedAt: string; truncated: boolean }
  | { status: 'empty'; collectedAt: string; truncated: boolean }
  | { status: 'error'; message: string };

type SnapshotSuccess = {
  vessels: Vessel[];
  collectedAt: string;
  truncated: boolean;
};

const SNAPSHOT_ERROR_MESSAGES = {
  no_api_key: 'Ключ AISStream не налаштовано',
  connect_failed: 'Не вдалося підключитися до джерела',
  provider_error: 'Джерело повернуло помилку',
  disconnected: "З'єднання з джерелом розірвано",
  internal: 'Внутрішня помилка сервера',
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isValidSpeed(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 102.2);
}

function isValidCourse(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360);
}

function parseVessel(value: unknown): Vessel | null {
  const vessel = record(value);
  if (
    !vessel ||
    typeof vessel.id !== 'string' || vessel.id.trim() === '' ||
    !(typeof vessel.name === 'string' || vessel.name === null) ||
    typeof vessel.lat !== 'number' || !Number.isFinite(vessel.lat) || vessel.lat < -90 || vessel.lat > 90 ||
    typeof vessel.lon !== 'number' || !Number.isFinite(vessel.lon) || vessel.lon < -180 || vessel.lon > 180 ||
    !isValidSpeed(vessel.speedKnots) ||
    !isValidCourse(vessel.courseDeg) ||
    typeof vessel.timestamp !== 'string' || formatTimestamp(vessel.timestamp) === 'Немає даних' ||
    vessel.source !== 'aisstream'
  ) {
    return null;
  }

  return vessel as unknown as Vessel;
}

function parseSnapshotSuccess(value: unknown): SnapshotSuccess | null {
  const result = record(value);
  if (
    !result ||
    result.ok !== true ||
    !Array.isArray(result.vessels) ||
    typeof result.collectedAt !== 'string' ||
    formatTimestamp(result.collectedAt) === 'Немає даних' ||
    result.windowSeconds !== AIS_SNAPSHOT_WINDOW_MS / 1_000 ||
    typeof result.count !== 'number' || !Number.isInteger(result.count) || result.count < 0 ||
    typeof result.truncated !== 'boolean' ||
    (result.reason !== 'window_elapsed' && result.reason !== 'limit_reached')
  ) {
    return null;
  }

  const vessels = result.vessels.map(parseVessel);
  if (vessels.some((vessel) => vessel === null) || result.count !== vessels.length) return null;
  if ((result.reason === 'limit_reached') !== result.truncated) return null;

  return {
    vessels: vessels as Vessel[],
    collectedAt: result.collectedAt,
    truncated: result.truncated,
  };
}

function parseSnapshotFailure(value: unknown): string | null {
  const result = record(value);
  const error = record(result?.error);
  if (
    result?.ok !== false ||
    !error ||
    typeof error.code !== 'string' ||
    !Object.hasOwn(SNAPSHOT_ERROR_MESSAGES, error.code)
  ) {
    return null;
  }

  return SNAPSHOT_ERROR_MESSAGES[error.code as keyof typeof SNAPSHOT_ERROR_MESSAGES];
}

function statusLabel(state: SnapshotState): string {
  if (state.status === 'idle-demo') return 'Демонстраційні дані';
  if (state.status === 'loading') return 'Завантаження…';
  if (state.status === 'error') return 'Даних на карті немає';

  const count = state.status === 'empty' ? 0 : state.vessels.length;
  const limitSuffix = state.truncated
    ? ` · зупинено на ліміті ${AIS_SNAPSHOT_MAX_VESSELS}`
    : '';
  const windowSeconds = AIS_SNAPSHOT_WINDOW_MS / 1_000;
  return `AISStream · знімок за ${windowSeconds} с · отримано ${formatTimestamp(state.collectedAt)} · суден: ${count} · вибірка неповна${limitSuffix}`;
}

export default function DemoMapClient() {
  const [demoState, setDemoState] = useState(() =>
    createInitialDemoState(DEMO_ROUTES, new Date().toISOString()),
  );
  const [snapshotState, setSnapshotState] = useState<SnapshotState>({ status: 'idle-demo' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  const demoTimerRef = useRef<number | null>(null);
  const hasResetMapViewRef = useRef(false);

  useEffect(() => {
    if (snapshotState.status !== 'idle-demo') return;

    const timerStartTime = new Date().toISOString();
    setDemoState(createInitialDemoState(DEMO_ROUTES, timerStartTime));

    const timerId = window.setInterval(() => {
      const tickTime = new Date().toISOString();
      setDemoState((current) => advanceDemoVessels(DEMO_ROUTES, current.progress, tickTime));
    }, DEMO_TICK_MS);
    demoTimerRef.current = timerId;

    return () => {
      window.clearInterval(timerId);
      if (demoTimerRef.current === timerId) demoTimerRef.current = null;
    };
  }, [snapshotState.status]);

  const demoVessels = demoState.vessels;
  const vessels = snapshotState.status === 'idle-demo'
    ? demoVessels
    : snapshotState.status === 'success'
      ? snapshotState.vessels
      : [];
  const selectedVessel = vessels.find((vessel) => vessel.id === selectedId) ?? null;

  const handleSnapshotRequest = async () => {
    if (snapshotState.status === 'loading') return;

    if (demoTimerRef.current !== null) {
      window.clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    setSelectedId(null);
    setSnapshotState({ status: 'loading' });

    try {
      const response = await fetch('/api/snapshot', { method: 'GET', cache: 'no-store' });
      const payload: unknown = await response.json();

      if (!response.ok) {
        setSnapshotState({
          status: 'error',
          message: parseSnapshotFailure(payload) ?? 'Внутрішня помилка сервера',
        });
        return;
      }

      const result = parseSnapshotSuccess(payload);
      if (!result) {
        setSnapshotState({
          status: 'error',
          message: 'Внутрішня помилка сервера',
        });
        return;
      }

      if (result.vessels.length === 0) {
        setSnapshotState({
          status: 'empty',
          collectedAt: result.collectedAt,
          truncated: result.truncated,
        });
        return;
      }

      if (!hasResetMapViewRef.current) {
        hasResetMapViewRef.current = true;
        setViewResetKey((current) => current + 1);
      }
      setSnapshotState({
        status: 'success',
        vessels: result.vessels,
        collectedAt: result.collectedAt,
        truncated: result.truncated,
      });
    } catch {
      setSnapshotState({
        status: 'error',
        message: 'Не вдалося підключитися до джерела',
      });
    }
  };

  const sourceLabel = statusLabel(snapshotState);
  const statusMessage = snapshotState.status === 'empty'
    ? 'За час збору позицій не отримано'
    : snapshotState.status === 'error'
      ? `Не вдалося отримати дані: ${snapshotState.message}`
      : null;

  return (
    <>
      <button
        className="snapshot-load-button"
        type="button"
        disabled={snapshotState.status === 'loading'}
        onClick={() => void handleSnapshotRequest()}
      >
        Завантажити справжні позиції
      </button>
      <p className="demo-data-label" aria-live="polite">{sourceLabel}</p>
      {statusMessage && <p className="snapshot-status-message" role="status">{statusMessage}</p>}
      {selectedVessel && <VesselCard vessel={selectedVessel} />}
      <LeafletMap
        config={APP_CONFIG}
        vessels={vessels}
        selectedId={selectedId}
        onSelect={setSelectedId}
        viewResetKey={viewResetKey}
      />
    </>
  );
}
