import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond } from '@/lib/storage/http';
import { parseFilter } from '@/features/finance/shared/query';
import { visibleRows } from '@/features/finance/shared/present';
import { renderFinanceWorkbook } from '@/features/finance-export/logic/rendering';
import { getAllFinance } from '@/features/overview/logic/finance-all';

export const runtime = 'nodejs';
const queryKeys = new Set(['period', 'day', 'search', 'project']);
const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel of the all-projects finance, owner only (the data function refuses everyone else). Same filters as the screen. */
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const keys = [...query.keys()];
    if (new Set(keys).size !== keys.length || keys.some(key => !queryKeys.has(key))) return respond(failure('VALIDATION'));
    const project = query.get('project') ?? undefined;
    if (project !== undefined && !/^[0-9a-f-]{36}$/i.test(project)) return respond(failure('VALIDATION'));
    const filter = parseFilter(Object.fromEntries(query));
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    const result = await getAllFinance(platform, context.value, { filter, ...(project ? { projectId: project } : {}) });
    if (!result.ok) return respond(result);
    const { book, projectOf } = result.value;
    // Same rows as the screen: narrowed by day and text, each tagged with its project.
    const shown = {
      ...book,
      months: book.months.map(block => ({
        ...block,
        incomeRows: visibleRows(block.incomeRows, filter).map(r => ({ ...r, details: `${projectOf[r.id] ?? ''} · ${r.details}` })),
        expenseRows: visibleRows(block.expenseRows, filter).map(r => ({ ...r, details: `${projectOf[r.id] ?? ''} · ${r.details}` })),
      })),
    };
    const bytes = await renderFinanceWorkbook(shown);
    const label = filter.period === 'all' ? 'כל-התקופה' : `${filter.period.year}-${String(filter.period.month).padStart(2, '0')}`;
    return new Response(bytes as BodyInit, { headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="finance.xlsx"; filename*=UTF-8''${encodeURIComponent(`כספים-כל-הפרויקטים-${label}.xlsx`)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return respond(failure('UNAVAILABLE')); }
}
