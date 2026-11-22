import { NextResponse, type NextRequest } from 'next/server';
import { createRequestDb, trustedClientIp } from '@/lib/db/clients';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // The foundation remains viewable before environment setup; data routes fail closed themselves.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) return response;
  const db = createRequestDb({
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      for (const { name, value } of values) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of values) response.cookies.set(name, value, options);
    },
  }, trustedClientIp(request.headers));
  await db.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)'] };
