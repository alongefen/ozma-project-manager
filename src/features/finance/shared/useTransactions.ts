'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Result, TransactionFields, TransactionRow } from '@/types/contracts';
import { cancelTransaction, createTransaction, updateTransaction } from '../logic/actions';

export type SaveState = { error: string | null; busy: boolean };

/** Create, update and cancel through the server actions; the page refreshes from the server afterwards. */
export function useTransactions(projectId: string) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>({ error: null, busy: false });
  const [, startTransition] = useTransition();

  async function run(action: () => Promise<Result<unknown>>): Promise<boolean> {
    setState({ error: null, busy: true });
    try {
      const result = await action();
      if (!result.ok) {
        setState({ error: result.error.message, busy: false });
        if (result.error.code === 'CONFLICT') startTransition(() => router.refresh());
        return false;
      }
      setState({ error: null, busy: false });
      startTransition(() => router.refresh());
      return true;
    } catch {
      setState({ error: 'הפעולה לא הושלמה. יש לנסות שוב', busy: false });
      return false;
    }
  }

  return {
    ...state,
    clearError: () => setState(s => ({ ...s, error: null })),
    create: (fields: TransactionFields, requestId: string) =>
      run(() => createTransaction({ requestId, projectId, fields })),
    update: (row: TransactionRow, fields: TransactionFields) =>
      run(() => updateTransaction({ id: row.id, expectedRevision: row.revision, fields })),
    cancel: (row: TransactionRow) => run(() => cancelTransaction({ id: row.id, expectedRevision: row.revision })),
  };
}
