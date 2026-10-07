import { getAisstreamApiKey } from '@/lib/aisstream/key';
import { createSnapshotErrorResponse, SnapshotError } from '@/lib/aisstream/errors';
import { collectSnapshot } from '@/lib/aisstream/collector';
import { parseSnapshotParams } from '@/lib/aisstream/snapshot-params';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const now = () => new Date();
  const attemptedAt = now().toISOString();
  const params = parseSnapshotParams(new URL(request.url).searchParams);

  if (!params) {
    return createSnapshotErrorResponse(new SnapshotError('invalid_params'), attemptedAt);
  }

  const apiKey = getAisstreamApiKey();
  if (!apiKey) {
    return createSnapshotErrorResponse(new SnapshotError('no_api_key'), attemptedAt);
  }

  try {
    const result = await collectSnapshot({
      apiKey,
      signal: request.signal,
      now,
      windowMs: params.windowSeconds * 1_000,
      includeClassB: params.includeClassB,
    });
    return Response.json({ ok: true, ...result, includeClassB: params.includeClassB });
  } catch (error) {
    return createSnapshotErrorResponse(error, attemptedAt);
  }
}
