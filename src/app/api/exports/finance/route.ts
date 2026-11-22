import type { FinanceExportApi, FinanceFilter } from '@/types/contracts';
import { createFinanceExportApi } from '@/features/finance-export/logic';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond } from '@/lib/storage/http';

export const runtime = 'nodejs';
const queryKeys = new Set(['projectId', 'period', 'day', 'search']);

// כאן נבדקת צורת השאילתה בלבד; המזהה והטווחים נבדקים בלוגיקה.
function parseQuery(query: URLSearchParams): Parameters<FinanceExportApi['renderWorkbook']>[1] | null {
  const keys = [...query.keys()];
  if (new Set(keys).size !== keys.length || keys.some(key => !queryKeys.has(key))) return null;
  const projectId = query.get('projectId');
  const period = query.get('period');
  const day = query.get('day');
  const search = query.get('search');
  if (projectId === null || period === null) return null;
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (period !== 'all' && !month) return null;
  if (day !== null && !/^\d{1,2}$/.test(day)) return null;
  const filter: FinanceFilter = { period: month ? { year: Number(month[1]), month: Number(month[2]) } : 'all' };
  if (day !== null) filter.day = Number(day);
  if (search !== null) filter.search = search;
  return { projectId, filter };
}

export async function GET(request: Request) {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    const input = parseQuery(new URL(request.url).searchParams);
    if (!input) return respond(failure('VALIDATION'));
    const result = await createFinanceExportApi(platform).renderWorkbook(context.value, input);
    if (!result.ok) return respond(result);
    const { fileName, contentType, stream } = result.value;
    return new Response(stream, { headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="finance.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return respond(failure('UNAVAILABLE')); }
}
