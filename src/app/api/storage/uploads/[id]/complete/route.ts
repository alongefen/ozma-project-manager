import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond, sameOrigin } from '@/lib/storage/http';
export const runtime = 'nodejs';
export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond(failure('FORBIDDEN'));
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    const { id } = await route.params;
    return respond(await platform.storage.finishUpload(context.value, { fileId: id }));
  } catch { return respond(failure('UNAVAILABLE')); }
}
