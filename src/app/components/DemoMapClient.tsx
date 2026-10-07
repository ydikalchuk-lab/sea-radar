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

type DisplayedData =
  | { source: 'demo' }
  | { source: 'aisstream'; vessels: Vessel[]; collectedAt: string; truncated: boolean };

type AttemptState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; collectedAt: string; count: number }
  | { status: 'empty'; collectedAt: string }
  | { status: 'error'; message: string; attemptedAt: string | null };

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

const NO_RESPONSE_MESSAGE = 'Немає відповіді сервера';

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

function parseSnapshotFailure(value: unknown): { message: string; attemptedAt: string | null } | null {
  const result = record(value);
  const error = record(result?.error);
  if (result?.ok !== false || !error || typeof error.code !== 'string') return null;

  const message = Object.hasOwn(SNAPSHOT_ERROR_MESSAGES, error.code)
    ? SNAPSHOT_ERROR_MESSAGES[error.code as keyof typeof SNAPSHOT_ERROR_MESSAGES]
    : SNAPSHOT_ERROR_MESSAGES.internal;
  const attemptedAt = typeof result.attemptedAt === 'string' && formatTimestamp(result.attemptedAt) !== 'Немає даних'
    ? result.attemptedAt
    : null;

  return { message, attemptedAt };
}

function sourceLabel(data: DisplayedData): string {
  if (data.source === 'demo') return 'Демонстраційні дані';

  const count = data.vessels.length;
  const limitSuffix = data.truncated
    ? ` · зупинено на ліміті ${AIS_SNAPSHOT_MAX_VESSELS}`
    : '';
  const windowSeconds = AIS_SNAPSHOT_WINDOW_MS / 1_000;
  return `AISStream · знімок за ${windowSeconds} с · отримано ${formatTimestamp(data.collectedAt)} · суден: ${count} · вибірка неповна${limitSuffix}`;
}

function attemptMessage(state: AttemptState): string | null {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return 'Завантаження…';

  if (state.status === 'success') {
    return `Спроба ${formatTimestamp(state.collectedAt)}: отримано суден: ${state.count}`;
  }
  if (state.status === 'empty') {
    return `Спроба ${formatTimestamp(state.collectedAt)}: за час збору позицій не отримано`;
  }

  const timestamp = state.status === 'error' && state.attemptedAt
    ? formatTimestamp(state.attemptedAt)
    : null;
  const prefix = timestamp && timestamp !== 'Немає даних' ? `Спроба ${timestamp}: ` : 'Спроба: ';
  return `${prefix}не вдалося отримати дані: ${state.message}`;
}

export default function DemoMapClient() {
  const [demoState, setDemoState] = useState(() =>
    createInitialDemoState(DEMO_ROUTES, new Date().toISOString()),
  );
  const [displayedData, setDisplayedData] = useState<DisplayedData>({ source: 'demo' });
  const [attemptState, setAttemptState] = useState<AttemptState>({ status: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  const demoTimerRef = useRef<number | null>(null);
  const hasResetMapViewRef = useRef(false);

  useEffect(() => {
    if (displayedData.source !== 'demo') return;

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
  }, [displayedData.source]);

  const demoVessels = demoState.vessels;
  const vessels = displayedData.source === 'demo' ? demoVessels : displayedData.vessels;
  const selectedVessel = vessels.find((vessel) => vessel.id === selectedId) ?? null;

  const handleSnapshotRequest = async () => {
    if (attemptState.status === 'loading') return;

    setAttemptState({ status: 'loading' });

    try {
      const response = await fetch('/api/snapshot', { method: 'GET', cache: 'no-store' });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const failure = parseSnapshotFailure(payload);
        setAttemptState({
          status: 'error',
          message: failure?.message ?? SNAPSHOT_ERROR_MESSAGES.internal,
          attemptedAt: failure?.attemptedAt ?? null,
        });
        return;
      }

      const result = parseSnapshotSuccess(payload);
      if (!result) {
        setAttemptState({
          status: 'error',
          message: SNAPSHOT_ERROR_MESSAGES.internal,
          attemptedAt: null,
        });
        return;
      }

      if (result.vessels.length === 0) {
        setAttemptState({ status: 'empty', collectedAt: result.collectedAt });
        return;
      }

      if (!hasResetMapViewRef.current) {
        hasResetMapViewRef.current = true;
        setViewResetKey((current) => current + 1);
      }
      setDisplayedData({
        source: 'aisstream',
        vessels: result.vessels,
        collectedAt: result.collectedAt,
        truncated: result.truncated,
      });
      setSelectedId((current) =>
        current !== null && result.vessels.some((vessel) => vessel.id === current) ? current : null,
      );
      setAttemptState({
        status: 'success',
        collectedAt: result.collectedAt,
        count: result.vessels.length,
      });
    } catch {
      setAttemptState({ status: 'error', message: NO_RESPONSE_MESSAGE, attemptedAt: null });
    }
  };

  const statusMessage = attemptMessage(attemptState);

  return (
    <>
      <section className="snapshot-panel" aria-label="Стан даних">
        <button
          className="snapshot-load-button"
          type="button"
          disabled={attemptState.status === 'loading'}
          onClick={() => void handleSnapshotRequest()}
        >
          Завантажити справжні позиції
        </button>
        <p className="demo-data-label" aria-live="polite">{sourceLabel(displayedData)}</p>
        {statusMessage && <p className="snapshot-status-message" role="status">{statusMessage}</p>}
        <p className="snapshot-page-hint">Після оновлення сторінки знову показуються демонстраційні дані</p>
        {selectedVessel && <VesselCard vessel={selectedVessel} />}
      </section>
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
