import { NextResponse } from 'next/server';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond } from '@/lib/storage/http';
export const runtime = 'nodejs';
export async function GET(request: Request, route: { params: Promise<{ id: string }> }) {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    const { id } = await route.params;
    const search = new URL(request.url).searchParams;
    const variant = search.get('variant') ?? 'original';
    if (variant !== 'original' && variant !== 'display') return respond(failure('VALIDATION'));
    const result = await platform.storage.getSignedUrl(context.value, { fileId: id, variant, download: search.get('download') === '1' });
    if (!result.ok) return respond(result);
    return NextResponse.redirect(result.value.url, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return respond(failure('UNAVAILABLE')); }
}
