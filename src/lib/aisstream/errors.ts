export type SnapshotErrorCode =
  | 'no_api_key'
  | 'connect_failed'
  | 'provider_error'
  | 'disconnected'
  | 'internal';

const SNAPSHOT_ERROR_MESSAGES: Record<SnapshotErrorCode, string> = {
  no_api_key: 'Ключ AISStream не налаштовано',
  connect_failed: 'Не вдалося підключитися до джерела',
  provider_error: 'Джерело повернуло помилку',
  disconnected: "З'єднання з джерелом розірвано",
  internal: 'Внутрішня помилка сервера',
};

export class SnapshotError extends Error {
  constructor(readonly code: SnapshotErrorCode) {
    super(SNAPSHOT_ERROR_MESSAGES[code]);
    this.name = 'SnapshotError';
  }
}

export function createSnapshotErrorResponse(error: unknown, attemptedAt: string): Response {
  const code = error instanceof SnapshotError ? error.code : 'internal';

  return Response.json(
    {
      ok: false,
      attemptedAt,
      error: {
        code,
        message: SNAPSHOT_ERROR_MESSAGES[code],
      },
    },
    { status: 502 },
  );
}
