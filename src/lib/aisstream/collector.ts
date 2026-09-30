import type { Vessel } from '@/types/vessel';
import { AIS_SNAPSHOT_MAX_VESSELS, AIS_SNAPSHOT_WINDOW_MS } from '@/config/app';
import { convertPositionReport } from './position-report';
import { SnapshotError, type SnapshotErrorCode } from './errors';
import {
  openAisStream,
  type AisStreamHandle,
  type AisStreamHandlers,
} from './reader';

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;
type TimerScheduler = (callback: () => void, delay: number) => TimerHandle;
type TimerCanceller = (timer: TimerHandle) => void;

export type SnapshotCollectionResult = {
  vessels: Vessel[];
  collectedAt: string;
  windowSeconds: number;
  count: number;
  truncated: boolean;
  reason: 'window_elapsed' | 'limit_reached';
};

type CollectorOptions = {
  apiKey: string;
  signal: AbortSignal;
  now?: () => Date;
  setTimer?: TimerScheduler;
  clearTimer?: TimerCanceller;
  openSource?: (handlers: AisStreamHandlers) => AisStreamHandle;
  windowMs?: number;
  maxVessels?: number;
};

export async function collectSnapshot({
  apiKey,
  signal,
  now = () => new Date(),
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  openSource = (handlers) => openAisStream({ apiKey, signal, ...handlers }),
  windowMs = AIS_SNAPSHOT_WINDOW_MS,
  maxVessels = AIS_SNAPSHOT_MAX_VESSELS,
}: CollectorOptions): Promise<SnapshotCollectionResult> {
  if (signal.aborted) throw new SnapshotError('internal');

  return new Promise<SnapshotCollectionResult>((resolve, reject) => {
    const vessels = new Map<string, Vessel>();
    let source: AisStreamHandle | undefined;
    let timer: TimerHandle | undefined;
    let ready = false;
    let settled = false;

    const cleanup = () => {
      if (timer !== undefined) {
        const activeTimer = timer;
        timer = undefined;
        try {
          clearTimer(activeTimer);
        } catch {
          // A timer cleanup failure must not replace the terminal result.
        }
      }
      signal.removeEventListener('abort', onAbort);
      try {
        source?.close();
      } catch {
        // A source cleanup failure must not replace the terminal result.
      }
    };

    const succeed = (reason: SnapshotCollectionResult['reason']) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        vessels: [...vessels.values()],
        collectedAt: now().toISOString(),
        windowSeconds: AIS_SNAPSHOT_WINDOW_MS / 1_000,
        count: vessels.size,
        truncated: reason === 'limit_reached',
        reason,
      });
    };

    const fail = (code: SnapshotErrorCode) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new SnapshotError(code));
    };

    const onAbort = () => fail('internal');
    const handlers: AisStreamHandlers = {
      onReady: () => { ready = true; },
      onMessage: (raw) => {
        if (settled) return;
        const vessel = convertPositionReport(raw);
        if (!vessel) return;

        const current = vessels.get(vessel.id);
        if (!current) {
          vessels.set(vessel.id, vessel);
          if (vessels.size >= maxVessels) succeed('limit_reached');
          return;
        }

        if (Date.parse(vessel.timestamp) > Date.parse(current.timestamp)) {
          vessels.set(vessel.id, vessel);
        }
      },
      onError: (code) => fail(code),
      onClose: () => fail('disconnected'),
    };

    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimer(() => {
      if (ready) succeed('window_elapsed');
      else fail('connect_failed');
    }, windowMs);

    if (settled) return;

    try {
      const openedSource = openSource(handlers);
      source = openedSource;
      if (settled) source.close();
    } catch {
      fail('connect_failed');
    }
  });
}
