import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond, sameOrigin } from '@/lib/storage/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return respond(failure('FORBIDDEN'));
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    let input: unknown;
    try { input = await request.json(); } catch { return respond(failure('VALIDATION')); }
    return respond(await platform.storage.beginUpload(context.value, input as Parameters<typeof platform.storage.beginUpload>[1]));
  } catch { return respond(failure('UNAVAILABLE')); }
}
