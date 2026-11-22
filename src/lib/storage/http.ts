import 'server-only';
import { NextResponse } from 'next/server';
import type { ErrorCode, Result } from '@/types/contracts';
const statuses: Record<ErrorCode, number> = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409, PROJECT_READ_ONLY: 403, LIMIT: 413, RATE_LIMITED: 429, UNAVAILABLE: 503 };
export function respond<T>(result: Result<T>) { return NextResponse.json(result, { status: result.ok ? 200 : statuses[result.error.code], headers: { 'Cache-Control': 'private, no-store' } }); }
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin && !['cross-site'].includes(request.headers.get('sec-fetch-site') ?? '');
}
