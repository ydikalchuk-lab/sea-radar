'use client';

import { useEffect, useRef, useState } from 'react';
import { DEMO_ROUTES } from '@/data/demo-vessels';
import {
  AIS_SNAPSHOT_MAX_VESSELS,
  APP_CONFIG,
  DEMO_TICK_MS,
  SNAPSHOT_WINDOW_OPTIONS,
} from '@/config/app';
import { advanceDemoVessels, createInitialDemoState } from '@/lib/demo-motion';
import { formatTimestamp } from '@/lib/vessel-display';
import type { Vessel } from '@/types/vessel';
import VesselCard from './VesselCard';
import LeafletMap from './LeafletMap';

type DisplayedData =
  | { source: 'demo' }
  | { source: 'empty' }
  | {
      source: 'aisstream';
      vessels: Vessel[];
      collectedAt: string;
      windowSeconds: number;
      includeClassB: boolean;
      truncated: boolean;
    };

type AttemptSettings = {
  windowSeconds: number;
  includeClassB: boolean;
};

type AttemptState =
  | { status: 'idle' }
  | ({ status: 'loading' } & AttemptSettings)
  | ({ status: 'cancelled' } & AttemptSettings)
  | ({ status: 'success'; collectedAt: string; count: number; diagnostics: SnapshotDiagnostics } & AttemptSettings)
  | ({ status: 'empty'; collectedAt: string; diagnostics: SnapshotDiagnostics } & AttemptSettings)
  | ({ status: 'error'; message: string; attemptedAt: string | null; diagnostics: SnapshotDiagnostics | null } & AttemptSettings);

type SnapshotDiagnostics = {
  connectMs: number | null;
  messages: number;
  rejected: number;
  byType: Record<string, number>;
};

type SnapshotSuccess = {
  vessels: Vessel[];
  collectedAt: string;
  windowSeconds: number;
  includeClassB: boolean;
  truncated: boolean;
  diagnostics: SnapshotDiagnostics;
};

const SNAPSHOT_ERROR_MESSAGES = {
  no_api_key: 'Ключ AISStream не налаштовано',
  invalid_params: 'Некоректні параметри запиту',
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

function parseSnapshotDiagnostics(value: unknown): SnapshotDiagnostics | null {
  const diagnostics = record(value);
  const byType = record(diagnostics?.byType);
  if (
    !diagnostics || !byType ||
    !(diagnostics.connectMs === null || (typeof diagnostics.connectMs === 'number' && Number.isFinite(diagnostics.connectMs) && diagnostics.connectMs >= 0)) ||
    typeof diagnostics.messages !== 'number' || !Number.isInteger(diagnostics.messages) || diagnostics.messages < 0 ||
    typeof diagnostics.rejected !== 'number' || !Number.isInteger(diagnostics.rejected) || diagnostics.rejected < 0
  ) {
    return null;
  }

  const allowedTypes = new Set(['PositionReport', 'StandardClassBPositionReport', 'other']);
  const safeByType: Record<string, number> = {};
  for (const [type, count] of Object.entries(byType)) {
    if (!allowedTypes.has(type)) continue;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null;
    safeByType[type] = count;
  }

  return {
    connectMs: diagnostics.connectMs as number | null,
    messages: diagnostics.messages,
    rejected: diagnostics.rejected,
    byType: safeByType,
  };
}

function parseSnapshotSuccess(value: unknown): SnapshotSuccess | null {
  const result = record(value);
  const diagnostics = parseSnapshotDiagnostics(result?.diagnostics);
  if (
    !result ||
    result.ok !== true ||
    !Array.isArray(result.vessels) ||
    typeof result.collectedAt !== 'string' ||
    formatTimestamp(result.collectedAt) === 'Немає даних' ||
    typeof result.windowSeconds !== 'number' || !SNAPSHOT_WINDOW_OPTIONS.includes(result.windowSeconds as (typeof SNAPSHOT_WINDOW_OPTIONS)[number]) ||
    typeof result.includeClassB !== 'boolean' ||
    diagnostics === null ||
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
    windowSeconds: result.windowSeconds,
    includeClassB: result.includeClassB,
    truncated: result.truncated,
    diagnostics,
  };
}

function parseSnapshotFailure(value: unknown): {
  message: string;
  attemptedAt: string | null;
  diagnostics: SnapshotDiagnostics | null;
} | null {
  const result = record(value);
  const error = record(result?.error);
  if (result?.ok !== false || !error || typeof error.code !== 'string') return null;

  const message = Object.hasOwn(SNAPSHOT_ERROR_MESSAGES, error.code)
    ? SNAPSHOT_ERROR_MESSAGES[error.code as keyof typeof SNAPSHOT_ERROR_MESSAGES]
    : SNAPSHOT_ERROR_MESSAGES.internal;
  const attemptedAt = typeof result.attemptedAt === 'string' && formatTimestamp(result.attemptedAt) !== 'Немає даних'
    ? result.attemptedAt
    : null;

  return {
    message,
    attemptedAt,
    diagnostics: result.diagnostics === null || result.diagnostics === undefined
      ? null
      : parseSnapshotDiagnostics(result.diagnostics),
  };
}

function sourceLabel(data: DisplayedData): string | null {
  if (data.source === 'demo') return 'Демонстраційні дані';
  if (data.source === 'empty') return 'Даних на карті немає';
  return null;
}

function vesselCountLabel(count: number): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} суден`;
  if (lastDigit === 1) return `${count} судно`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} судна`;
  return `${count} суден`;
}

function formatWindowValue(windowSeconds: number): string {
  return windowSeconds < 120 ? `${windowSeconds} с` : `${windowSeconds / 60} хв`;
}

function formatWindowAriaValue(windowSeconds: number): string {
  if (windowSeconds <= 60) return `${windowSeconds} секунд`;
  const minutes = windowSeconds / 60;
  const ending = minutes === 5 ? 'хвилин' : 'хвилини';
  return `${minutes} ${ending}`;
}

function formatDiagnostics(diagnostics: SnapshotDiagnostics, vesselCount?: number): string {
  const connection = diagnostics.connectMs === null
    ? 'не відкрито'
    : `${(diagnostics.connectMs / 1_000).toFixed(1).replace('.', ',')} с`;
  const breakdown = Object.entries(diagnostics.byType)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
  const vesselSuffix = vesselCount === undefined ? '' : ` · суден: ${vesselCount}`;
  return `з'єднання: ${connection} · повідомлень: ${diagnostics.messages}${breakdown ? ` (${breakdown})` : ''} · відкинуто: ${diagnostics.rejected}${vesselSuffix}`;
}

function requestSummary(state: AttemptState): string | null {
  if (state.status === 'idle' || state.status === 'success') return null;
  const classB = state.includeClassB ? 'увімкнено' : 'вимкнено';
  return `Запит: ${state.windowSeconds} с · клас B: ${classB}`;
}

function attemptMessage(state: AttemptState): string | null {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return 'Завантаження…';
  if (state.status === 'cancelled') return 'Завантаження скасовано';

  if (state.status === 'success') return null;
  if (state.status === 'empty') {
    return `Спроба ${formatTimestamp(state.collectedAt)}: за час збору позицій не отримано`;
  }

  const timestamp = state.attemptedAt ? formatTimestamp(state.attemptedAt) : null;
  const prefix = timestamp && timestamp !== 'Немає даних' ? `Спроба ${timestamp}: ` : 'Спроба: ';
  return `${prefix}не вдалося отримати дані: ${state.message}`;
}

export default function DemoMapClient() {
  const [demoState, setDemoState] = useState(() =>
    createInitialDemoState(DEMO_ROUTES, new Date().toISOString()),
  );
  const [displayedData, setDisplayedData] = useState<DisplayedData>({ source: 'demo' });
  const [attemptState, setAttemptState] = useState<AttemptState>({ status: 'idle' });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [windowIndex, setWindowIndex] = useState(0);
  const [includeClassB, setIncludeClassB] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewResetKey, setViewResetKey] = useState(0);
  const demoTimerRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestStartedAtRef = useRef<number | null>(null);
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

  useEffect(() => () => {
    requestControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (attemptState.status !== 'loading') return;
    const startedAt = requestStartedAtRef.current ?? Date.now();
    const timerId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(timerId);
  }, [attemptState.status]);

  const demoVessels = demoState.vessels;
  const vessels = displayedData.source === 'demo'
    ? demoVessels
    : displayedData.source === 'aisstream'
      ? displayedData.vessels
      : [];
  const selectedVessel = vessels.find((vessel) => vessel.id === selectedId) ?? null;

  const handleSnapshotRequest = async () => {
    if (requestControllerRef.current) return;

    const windowSeconds = SNAPSHOT_WINDOW_OPTIONS[windowIndex];
    const requestIncludesClassB = includeClassB;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestStartedAtRef.current = Date.now();
    setElapsedMs(0);
    setAttemptState({ status: 'loading', windowSeconds, includeClassB: requestIncludesClassB });

    try {
      const query = new URLSearchParams({
        window: String(windowSeconds),
        classB: requestIncludesClassB ? '1' : '0',
      });
      const response = await fetch(`/api/snapshot?${query}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload: unknown = await response.json();

      if (controller.signal.aborted) return;
      if (!response.ok) {
        const failure = parseSnapshotFailure(payload);
        setAttemptState({
          status: 'error',
          windowSeconds,
          includeClassB: requestIncludesClassB,
          message: failure?.message ?? SNAPSHOT_ERROR_MESSAGES.internal,
          attemptedAt: failure?.attemptedAt ?? null,
          diagnostics: failure?.diagnostics ?? null,
        });
        return;
      }

      const result = parseSnapshotSuccess(payload);
      if (!result || result.windowSeconds !== windowSeconds || result.includeClassB !== requestIncludesClassB) {
        setAttemptState({
          status: 'error',
          windowSeconds,
          includeClassB: requestIncludesClassB,
          message: SNAPSHOT_ERROR_MESSAGES.internal,
          attemptedAt: null,
          diagnostics: null,
        });
        return;
      }

      if (result.vessels.length === 0) {
        setAttemptState({
          status: 'empty',
          windowSeconds,
          includeClassB: requestIncludesClassB,
          collectedAt: result.collectedAt,
          diagnostics: result.diagnostics,
        });
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
        windowSeconds: result.windowSeconds,
        includeClassB: result.includeClassB,
        truncated: result.truncated,
      });
      setSelectedId((current) =>
        current !== null && result.vessels.some((vessel) => vessel.id === current) ? current : null,
      );
      setAttemptState({
        status: 'success',
        windowSeconds,
        includeClassB: requestIncludesClassB,
        collectedAt: result.collectedAt,
        count: result.vessels.length,
        diagnostics: result.diagnostics,
      });
    } catch {
      if (controller.signal.aborted) return;
      setAttemptState({
        status: 'error',
        windowSeconds,
        includeClassB: requestIncludesClassB,
        message: NO_RESPONSE_MESSAGE,
        attemptedAt: null,
        diagnostics: null,
      });
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        requestStartedAtRef.current = null;
      }
    }
  };

  const cancelSnapshotRequest = () => {
    const controller = requestControllerRef.current;
    if (!controller || attemptState.status !== 'loading') return;
    controller.abort();
    requestControllerRef.current = null;
    requestStartedAtRef.current = null;
    setDisplayedData({ source: 'empty' });
    setSelectedId(null);
    setAttemptState({
      status: 'cancelled',
      windowSeconds: attemptState.windowSeconds,
      includeClassB: attemptState.includeClassB,
    });
  };

  const statusMessage = attemptMessage(attemptState);
  const selectedWindowSeconds = SNAPSHOT_WINDOW_OPTIONS[windowIndex];
  const isLoading = attemptState.status === 'loading';
  const requestSummaryText = requestSummary(attemptState);
  const progressWindowSeconds = isLoading ? attemptState.windowSeconds : 0;
  const windowExpired = isLoading && elapsedMs >= progressWindowSeconds * 1_000;
  const progressValue = isLoading
    ? Math.min(99, Math.floor((elapsedMs / (progressWindowSeconds * 1_000)) * 100))
    : 0;
  const progressLabel = windowExpired ? 'Час вікна минув · очікуємо відповідь' : null;
  const progressValueText = windowExpired
    ? `Часове вікно ${progressWindowSeconds} секунд минуло; очікуємо відповідь`
    : `Орієнтовно ${Math.floor(Math.min(elapsedMs, progressWindowSeconds * 1_000) / 1_000)} з ${progressWindowSeconds} секунд`;
  const diagnostics = attemptState.status === 'success' || attemptState.status === 'empty' || attemptState.status === 'error'
    ? attemptState.diagnostics
    : null;
  const diagnosticVesselCount = attemptState.status === 'success' ? attemptState.count : undefined;

  return (
    <>
      <section className="snapshot-panel" aria-label="Стан даних">
        <label className="snapshot-window-control">
          <span>Вікно збору: {formatWindowValue(selectedWindowSeconds)}</span>
          <input
            aria-label="Вікно збору"
            aria-valuetext={formatWindowAriaValue(selectedWindowSeconds)}
            type="range"
            min={0}
            max={SNAPSHOT_WINDOW_OPTIONS.length - 1}
            step={1}
            value={windowIndex}
            disabled={isLoading}
            onChange={(event) => setWindowIndex(Number(event.currentTarget.value))}
          />
          <span className="snapshot-window-options">15 с · 30 с · 60 с · 2 хв · 3 хв · 4 хв · 5 хв</span>
        </label>
        <label className="snapshot-class-b-control">
          <input
            type="checkbox"
            checked={includeClassB}
            disabled={isLoading}
            onChange={(event) => setIncludeClassB(event.currentTarget.checked)}
          />
          Малі судна (клас B)
        </label>
        <button
          className="snapshot-load-button"
          type="button"
          onClick={(event) => {
            if (isLoading) {
              if (event.detail <= 1) cancelSnapshotRequest();
            } else {
              void handleSnapshotRequest();
            }
          }}
        >
          {isLoading ? 'Скасувати' : 'Завантажити справжні позиції'}
        </button>
        {(statusMessage || requestSummaryText) && (
          <div className={`snapshot-attempt${isLoading ? ' snapshot-attempt--loading' : ''}`}>
            {statusMessage && <p className="snapshot-status-message" role="status">{statusMessage}</p>}
            {isLoading && (
              <div className="snapshot-progress">
                <div
                  className="snapshot-progress-track"
                  role="progressbar"
                  aria-label="Орієнтовний час збору"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressValue}
                  aria-valuetext={progressValueText}
                >
                  <span className="snapshot-progress-fill" style={{ width: `${progressValue}%` }} />
                </div>
                {progressLabel && <p className="snapshot-progress-label">{progressLabel}</p>}
              </div>
            )}
            {requestSummaryText && <p className="snapshot-request-summary">{requestSummaryText}</p>}
          </div>
        )}
        <div className="snapshot-source-row">
          <div
            className={`demo-data-label${displayedData.source === 'aisstream' ? ' snapshot-data-summary' : ''}`}
            aria-live="polite"
          >
            {displayedData.source === 'aisstream' ? (
              <>
                <div className="snapshot-data-heading">
                  <span className="snapshot-data-source">AISStream</span>
                  <strong className="snapshot-data-count">{vesselCountLabel(displayedData.vessels.length)}</strong>
                </div>
                <div className="snapshot-data-meta">
                  <span>Знімок · {formatTimestamp(displayedData.collectedAt)}</span>
                  <span>Вікно · {displayedData.windowSeconds} с</span>
                </div>
                <div className="snapshot-data-badges">
                  {displayedData.truncated && (
                    <span className="snapshot-data-badge snapshot-data-badge--limit">
                      Ліміт: {AIS_SNAPSHOT_MAX_VESSELS}
                    </span>
                  )}
                  <span className="snapshot-data-badge snapshot-data-badge--incomplete">Вибірка неповна</span>
                  {displayedData.includeClassB && <span className="snapshot-data-badge">Клас B: увімкнено</span>}
                </div>
              </>
            ) : sourceLabel(displayedData)}
          </div>
          <button
            className="snapshot-collapse-button"
            type="button"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((current) => !current)}
          >
            {isCollapsed ? 'Розгорнути' : 'Згорнути'}
          </button>
        </div>
        {!isCollapsed && (
          <>
            <p className="snapshot-page-hint">Після оновлення сторінки знову показуються демонстраційні дані</p>
            {diagnostics && (
              <details className="snapshot-details">
                <summary>Докладно</summary>
                <p>{formatDiagnostics(diagnostics, diagnosticVesselCount)}</p>
              </details>
            )}
            {selectedVessel && <VesselCard vessel={selectedVessel} />}
          </>
        )}
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
