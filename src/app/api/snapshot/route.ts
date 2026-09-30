import { getAisstreamApiKey } from '@/lib/aisstream/key';
import { createSnapshotErrorResponse, SnapshotError } from '@/lib/aisstream/errors';
import { collectSnapshot } from '@/lib/aisstream/collector';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const now = () => new Date();
  const attemptedAt = now().toISOString();
  const apiKey = getAisstreamApiKey();

  if (!apiKey) {
    return createSnapshotErrorResponse(new SnapshotError('no_api_key'), attemptedAt);
  }

  try {
    const result = await collectSnapshot({ apiKey, signal: request.signal, now });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return createSnapshotErrorResponse(error, attemptedAt);
  }
}
