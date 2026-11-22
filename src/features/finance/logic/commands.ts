import 'server-only';
import type { FinanceApi, Platform } from '@/types/contracts';
import { FinanceApiInputSchemas as inputs } from '@/types/contracts/schemas';
import { failure } from '@/lib/db/rpc';

export function createFinanceCommands(platform: Platform): Pick<FinanceApi, 'createTransaction' | 'updateTransaction' | 'cancelTransaction' | 'setExcelLink'> {
  return {
    async createTransaction(ctx, input) {
      const parsed = inputs.createTransaction.safeParse(input);
      return parsed.success ? platform.rpc(ctx, 'create_transaction', parsed.data) : failure('VALIDATION');
    },
    async updateTransaction(ctx, input) {
      const parsed = inputs.updateTransaction.safeParse(input);
      return parsed.success ? platform.rpc(ctx, 'update_transaction', parsed.data) : failure('VALIDATION');
    },
    async cancelTransaction(ctx, input) {
      const parsed = inputs.cancelTransaction.safeParse(input);
      return parsed.success ? platform.rpc(ctx, 'cancel_transaction', parsed.data) : failure('VALIDATION');
    },
    async setExcelLink(ctx, input) {
      const parsed = inputs.setExcelLink.safeParse(input);
      return parsed.success ? platform.rpc(ctx, 'set_finance_link', parsed.data) : failure('VALIDATION');
    },
  };
}
