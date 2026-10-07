import WebSocket, { type RawData } from 'ws';
import { AIS_SNAPSHOT_WINDOW_MS, APP_CONFIG } from '@/config/app';
import { SnapshotError, type SnapshotErrorCode } from './errors';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

export type AisStreamHandlers = {
  onReady: () => void;
  onMessage: (message: unknown) => void;
  onMalformedMessage?: () => void;
  onError: (code: SnapshotErrorCode) => void;
  onClose: () => void;
};

export type AisStreamHandle = {
  close: () => void;
};

type SocketLike = {
  on(event: 'open', listener: () => void): unknown;
  on(event: 'message', listener: (data: RawData, isBinary: boolean) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  send(data: string): void;
  close(): void;
};

type SocketFactory = (url: string, options: WebSocket.ClientOptions) => SocketLike;
type TimerHandle = ReturnType<typeof globalThis.setTimeout>;
type TimerScheduler = (callback: () => void, delay: number) => TimerHandle;
type TimerCanceller = (timer: TimerHandle) => void;

export function buildSubscription(apiKey: string, { includeClassB = false }: { includeClassB?: boolean } = {}) {
  const [southWest, northEast] = APP_CONFIG.bounds;
  return {
    APIKey: apiKey,
    BoundingBoxes: [[southWest, northEast]],
    FilterMessageTypes: includeClassB
      ? ['PositionReport', 'StandardClassBPositionReport']
      : ['PositionReport'],
  };
}

type ReaderOptions = {
  apiKey: string;
  signal: AbortSignal;
  includeClassB?: boolean;
  now?: () => Date;
  setTimeout?: TimerScheduler;
  clearTimeout?: TimerCanceller;
  socketFactory?: SocketFactory;
};

export type RawReadResult = {
  raw: unknown | null;
  collectedAt: string;
};

function decodeMessage(data: RawData): unknown {
  if (Array.isArray(data)) return JSON.parse(Buffer.concat(data).toString('utf8')) as unknown;
  if (Buffer.isBuffer(data)) return JSON.parse(data.toString('utf8')) as unknown;
  return JSON.parse(Buffer.from(data).toString('utf8')) as unknown;
}

function isProviderError(message: unknown): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  const messageType = (message as { MessageType?: unknown }).MessageType;
  return typeof messageType === 'string' && messageType.toLowerCase() === 'error';
}

export function openAisStream({
  apiKey,
  signal,
  onReady,
  onMessage,
  onMalformedMessage,
  onError,
  onClose,
  socketFactory = (url, options) => new WebSocket(url, options),
  includeClassB = false,
}: ReaderOptions & AisStreamHandlers): AisStreamHandle {
  let socket: SocketLike | undefined;
  let subscribed = false;
  let closed = false;

  const closeSocket = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener('abort', onAbort);
    try {
      socket?.close();
    } catch {
      // A close failure must not replace the terminal result.
    }
  };

  const fail = (code: SnapshotErrorCode) => {
    if (closed) return;
    closeSocket();
    onError(code);
  };

  const onAbort = () => fail('internal');
  if (signal.aborted) {
    onError('internal');
    return { close: () => undefined };
  }
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    socket = socketFactory(AISSTREAM_URL, { perMessageDeflate: true });
  } catch {
    fail('connect_failed');
    return { close: closeSocket };
  }

  const activeSocket = socket;
  activeSocket.on('open', () => {
    if (closed) return;
    try {
      activeSocket.send(JSON.stringify(buildSubscription(apiKey, { includeClassB })));
      subscribed = true;
      onReady();
    } catch {
      fail('connect_failed');
    }
  });

  activeSocket.on('message', (data) => {
    if (closed) return;
    let message: unknown;
    try {
      message = decodeMessage(data);
    } catch {
      if (onMalformedMessage) onMalformedMessage();
      else fail('provider_error');
      return;
    }
    try {
      onMessage(message);
    } catch {
      fail('internal');
      return;
    }
    if (isProviderError(message)) fail('provider_error');
  });

  activeSocket.on('error', () => {
    fail(subscribed ? 'provider_error' : 'connect_failed');
  });

  activeSocket.on('close', () => {
    if (closed) return;
    const wasSubscribed = subscribed;
    closed = true;
    signal.removeEventListener('abort', onAbort);
    try {
      activeSocket.close();
    } catch {
      // The peer may have already closed the connection.
    }
    if (wasSubscribed) onClose();
    else onError('connect_failed');
  });

  return { close: closeSocket };
}

export async function readFirstRawMessage({
  apiKey,
  signal,
  now = () => new Date(),
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  socketFactory,
}: ReaderOptions): Promise<RawReadResult> {
  if (signal.aborted) throw new SnapshotError('internal');

  return new Promise<RawReadResult>((resolve, reject) => {
    let stream: AisStreamHandle | undefined;
    let subscribed = false;
    let settled = false;
    let timeout: TimerHandle | undefined;

    const cleanup = () => {
      if (timeout !== undefined) {
        cancel(timeout);
        timeout = undefined;
      }
      stream?.close();
    };

    const succeed = (raw: unknown | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ raw, collectedAt: now().toISOString() });
    };

    const fail = (code: SnapshotErrorCode) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new SnapshotError(code));
    };

    timeout = schedule(() => {
      if (subscribed) succeed(null);
      else fail('connect_failed');
    }, AIS_SNAPSHOT_WINDOW_MS);

    stream = openAisStream({
      apiKey,
      signal,
      socketFactory,
      onReady: () => { subscribed = true; },
      onMessage: succeed,
      onError: fail,
      onClose: () => fail('disconnected'),
    });
  });
}
