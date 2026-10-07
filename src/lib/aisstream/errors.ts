import type { SnapshotDiagnostics } from './collector';

export type SnapshotErrorCode =
  | 'no_api_key'
  | 'invalid_params'
  | 'connect_failed'
  | 'provider_error'
  | 'disconnected'
  | 'internal';

const SNAPSHOT_ERROR_MESSAGES: Record<SnapshotErrorCode, string> = {
  no_api_key: 'Ключ AISStream не налаштовано',
  invalid_params: 'Некоректні параметри запиту',
  connect_failed: 'Не вдалося підключитися до джерела',
  provider_error: 'Джерело повернуло помилку',
  disconnected: "З'єднання з джерелом розірвано",
  internal: 'Внутрішня помилка сервера',
};

export class SnapshotError extends Error {
  constructor(
    readonly code: SnapshotErrorCode,
    readonly diagnostics: SnapshotDiagnostics | null = null,
  ) {
    super(SNAPSHOT_ERROR_MESSAGES[code]);
    this.name = 'SnapshotError';
  }
}

export function createSnapshotErrorResponse(error: unknown, attemptedAt: string): Response {
  const code = error instanceof SnapshotError ? error.code : 'internal';
  const diagnostics = error instanceof SnapshotError ? error.diagnostics : null;

  return Response.json(
    {
      ok: false,
      attemptedAt,
      error: {
        code,
        message: SNAPSHOT_ERROR_MESSAGES[code],
      },
      diagnostics,
    },
    { status: code === 'invalid_params' ? 400 : 502 },
  );
}
