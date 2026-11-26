import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond, sameOrigin } from '@/lib/storage/http';
export const runtime = 'nodejs';
// Large HEIC photos are converted here; be explicit instead of relying on the plan default (within Hobby limits, A-42).
export const maxDuration = 60;
export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond(failure('FORBIDDEN'));
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    const { id } = await route.params;
    const started = Date.now();
    const result = await platform.storage.finishUpload(context.value, { fileId: id });
    // Identifies the cause next time: code and duration only, no names or user data.
    if (!result.ok) console.error('[upload] complete refused', { fileId: id, code: result.error.code, ms: Date.now() - started });
    return respond(result);
  } catch (error) { console.error('[upload] complete threw', error instanceof Error ? error.message : 'unknown'); return respond(failure('UNAVAILABLE')); }
}
