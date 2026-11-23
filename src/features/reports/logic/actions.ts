'use server';

import type { ReportsApi } from '@/types/contracts';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { createReportsApi } from './service';

// Only planning is an action; the PDF itself leaves through GET /api/reports/diary.
export async function planReport(input: Parameters<ReportsApi['planReport']>[1]) {
  try {
    const platform = await createPlatform();
    const ctx = await platform.auth.getContext();
    if (!ctx.ok) return ctx;
    return await createReportsApi(platform).planReport(ctx.value, input);
  } catch { return failure('UNAVAILABLE'); }
}
