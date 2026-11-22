import 'server-only';
import type { FinanceExportApi, FinanceFilter, Platform } from '@/types/contracts';
import { FinanceExportApiInputSchemas as inputs } from '@/types/contracts/schemas';
import { createFinanceApi } from '@/features/finance/logic';
import { failure } from '@/lib/db/rpc';
import { renderFinanceWorkbook } from './rendering';

const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function workbookName(period: FinanceFilter['period']): string {
  const label = period === 'all' ? 'כל-התקופה' : `${period.year}-${String(period.month).padStart(2, '0')}`;
  return `כספים-${label}.xlsx`;
}

export function createFinanceExportQueries(platform: Platform): Pick<FinanceExportApi, 'renderWorkbook'> {
  const finance = createFinanceApi(platform);
  return {
    async renderWorkbook(ctx, input) {
      const parsed = inputs.renderWorkbook.safeParse(input);
      if (!parsed.success) return failure('VALIDATION');
      const { day, period } = parsed.data.filter;
      // החוזה מגדיר יום כמספר כלשהו, ולכן הטווח נבדק כאן.
      if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) return failure('VALIDATION');
      try {
        const book = await finance.getBook(ctx, parsed.data);
        if (!book.ok) return book;
        const bytes = await renderFinanceWorkbook(book.value);
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });
        return { ok: true, value: { fileName: workbookName(period), contentType, stream } };
      } catch { return failure('UNAVAILABLE'); }
    },
  };
}
