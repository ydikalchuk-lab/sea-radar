import { EventEmitter } from 'node:events';
import { expect, test } from '@playwright/test';
import { GET } from '../src/app/api/snapshot/route';
import { buildSubscription, openAisStream, readFirstRawMessage } from '../src/lib/aisstream/reader';

type FakeSocket = EventEmitter & {
  sent: string[];
  closeCalls: number;
  send(data: string): void;
  close(): void;
};

function createFakeSocket(): FakeSocket {
  const socket = new EventEmitter() as FakeSocket;
  socket.sent = [];
  socket.closeCalls = 0;
  socket.send = (data) => socket.sent.push(data);
  socket.close = () => {
    socket.closeCalls += 1;
  };
  return socket;
}

function createReaderOptions(socket: FakeSocket) {
  let timeoutCallback: (() => void) | undefined;
  let timeoutDelay = 0;
  const cleared: unknown[] = [];
  const startedAt = new Date('2026-09-30T12:00:00.000Z');
  return {
    options: {
      apiKey: 'dummy-not-a-real-key',
      signal: new AbortController().signal,
      now: () => startedAt,
      socketFactory: () => socket,
      setTimeout: (callback: () => void, delay: number) => {
        timeoutCallback = callback;
        timeoutDelay = delay;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (timer: ReturnType<typeof setTimeout>) => {
        cleared.push(timer);
      },
    },
    fireTimeout: () => timeoutCallback?.(),
    getTimeoutDelay: () => timeoutDelay,
    cleared,
  };
}

test('builds the default and class B AISStream subscriptions', () => {
  expect(buildSubscription('synthetic-key')).toEqual({
    APIKey: 'synthetic-key',
    BoundingBoxes: [[[50.75, 0.95], [51.25, 1.95]]],
    FilterMessageTypes: ['PositionReport'],
  });
  expect(buildSubscription('synthetic-key', { includeClassB: true })).toEqual({
    APIKey: 'synthetic-key',
    BoundingBoxes: [[[50.75, 0.95], [51.25, 1.95]]],
    FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport'],
  });
});

test('counts malformed JSON through the malformed-message handler without exposing it', () => {
  const socket = createFakeSocket();
  const controller = new AbortController();
  let malformedCount = 0;
  const errors: string[] = [];
  const options = {
    apiKey: 'dummy-not-a-real-key',
    signal: controller.signal,
    socketFactory: () => socket,
    onReady: () => undefined,
    onMessage: () => undefined,
    onMalformedMessage: () => { malformedCount += 1; },
    onError: (code: string) => { errors.push(code); },
    onClose: () => undefined,
  } as Parameters<typeof openAisStream>[0];

  openAisStream(options);
  socket.emit('open');
  socket.emit('message', Buffer.from('{broken json'), true);

  expect(malformedCount).toBe(1);
  expect(errors).toEqual([]);
  expect(socket.closeCalls).toBe(0);
});

test('starts the 15-second deadline before constructing the socket', async () => {
  const order: string[] = [];
  const socket = createFakeSocket();
  let timeoutCallback: (() => void) | undefined;
  const pending = readFirstRawMessage({
    apiKey: 'dummy-not-a-real-key',
    signal: new AbortController().signal,
    now: () => new Date('2026-09-30T12:00:00.000Z'),
    setTimeout: (callback, delay) => {
      order.push(`timer:${delay}`);
      timeoutCallback = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: () => undefined,
    socketFactory: () => {
      order.push('socket');
      return socket;
    },
  });

  expect(order).toEqual(['timer:15000', 'socket']);
  timeoutCallback?.();
  await expect(pending).rejects.toMatchObject({ code: 'connect_failed' });
});

test('sends the bounded PositionReport subscription immediately on open and returns the first raw frame', async () => {
  const socket = createFakeSocket();
  const fixture = createReaderOptions(socket);
  const pending = readFirstRawMessage(fixture.options);

  socket.emit('open');
  expect(JSON.parse(socket.sent[0])).toEqual({
    APIKey: 'dummy-not-a-real-key',
    BoundingBoxes: [[[50.75, 0.95], [51.25, 1.95]]],
    FilterMessageTypes: ['PositionReport'],
  });

  const raw = { MessageType: 'PositionReport', MetaData: { MMSI: 211000001 } };
  socket.emit('message', Buffer.from(JSON.stringify(raw)), true);

  await expect(pending).resolves.toEqual({
    raw,
    collectedAt: '2026-09-30T12:00:00.000Z',
  });
  expect(fixture.getTimeoutDelay()).toBe(15_000);
  expect(socket.closeCalls).toBe(1);
  expect(fixture.cleared).toHaveLength(1);
});

test('returns raw null only when the socket is open and subscribed through the deadline', async () => {
  const socket = createFakeSocket();
  const fixture = createReaderOptions(socket);
  const pending = readFirstRawMessage(fixture.options);

  socket.emit('open');
  fixture.fireTimeout();

  await expect(pending).resolves.toEqual({
    raw: null,
    collectedAt: '2026-09-30T12:00:00.000Z',
  });
  expect(socket.sent).toHaveLength(1);
  expect(socket.closeCalls).toBe(1);
  expect(fixture.cleared).toHaveLength(1);
});

test('treats a deadline before socket open as a connection failure', async () => {
  const socket = createFakeSocket();
  const fixture = createReaderOptions(socket);
  const pending = readFirstRawMessage(fixture.options);

  fixture.fireTimeout();

  await expect(pending).rejects.toMatchObject({ code: 'connect_failed' });
  expect(socket.sent).toHaveLength(0);
  expect(socket.closeCalls).toBe(1);
});

test('does not expose socket error text and closes after an opened connection fails', async () => {
  const socket = createFakeSocket();
  const fixture = createReaderOptions(socket);
  const pending = readFirstRawMessage(fixture.options);

  socket.emit('open');
  socket.emit('error', new Error('private provider detail'));

  await expect(pending).rejects.toMatchObject({
    code: 'provider_error',
    message: 'Джерело повернуло помилку',
  });
  expect(socket.closeCalls).toBe(1);
  expect(fixture.cleared).toHaveLength(1);
});

test('treats a close after subscription as a disconnect', async () => {
  const socket = createFakeSocket();
  const fixture = createReaderOptions(socket);
  const pending = readFirstRawMessage(fixture.options);

  socket.emit('open');
  socket.emit('close');

  await expect(pending).rejects.toMatchObject({ code: 'disconnected' });
  expect(socket.closeCalls).toBe(1);
  expect(fixture.cleared).toHaveLength(1);
});

test('aborts the socket and rejects the pending read when the request is cancelled', async () => {
  const socket = createFakeSocket();
  const fixture = createReaderOptions(socket);
  const controller = new AbortController();
  const pending = readFirstRawMessage({ ...fixture.options, signal: controller.signal });

  controller.abort();

  await expect(pending).rejects.toMatchObject({ code: 'internal' });
  expect(socket.closeCalls).toBe(1);
  expect(fixture.cleared).toHaveLength(1);
});

test('rejects invalid snapshot parameters before checking the API key', async () => {
  const originalValue = process.env.AISSTREAM_API_KEY;
  delete process.env.AISSTREAM_API_KEY;

  try {
    const response = await GET(new Request('http://localhost/api/snapshot?window=16'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'invalid_params',
        message: 'Некоректні параметри запиту',
      },
      diagnostics: null,
    });
  } finally {
    if (originalValue === undefined) {
      delete process.env.AISSTREAM_API_KEY;
    } else {
      process.env.AISSTREAM_API_KEY = originalValue;
    }
  }
});

test('returns the stable missing-key response without opening a socket', async () => {
  const originalValue = process.env.AISSTREAM_API_KEY;
  delete process.env.AISSTREAM_API_KEY;

  try {
    const response = await GET(new Request('http://localhost/api/snapshot'));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'no_api_key',
        message: 'Ключ AISStream не налаштовано',
      },
    });
  } finally {
    if (originalValue === undefined) {
      delete process.env.AISSTREAM_API_KEY;
    } else {
      process.env.AISSTREAM_API_KEY = originalValue;
    }
  }
});
