'use client';
import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { FinanceFilter } from '@/types/contracts';
import { financeHref } from './query';

type Nav = { filter: FinanceFilter; go(next: FinanceFilter): void; pending: boolean };
const Ctx = createContext<Nav | null>(null);

/**
 * Filter navigation with instant feedback: the chosen period shows at once (optimistic) and the
 * content dims while the server recomputes the book, instead of looking frozen on the old month.
 */
export function FinanceNavProvider({ projectId, filter, children }: { projectId: string; filter: FinanceFilter; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(filter);
  const go = (next: FinanceFilter) => start(() => { setShown(next); router.push(financeHref(projectId, next)); });
  return (
    <Ctx.Provider value={{ filter: shown, go, pending }}>
      <div className="fin-wrap" data-pending={pending || undefined} aria-busy={pending}>
        {pending && <div className="fin-progress" role="status"><span className="sr-only">טוען…</span></div>}
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useFinanceNav(): Nav {
  const nav = useContext(Ctx);
  if (!nav) throw new Error('FinanceNavProvider missing');
  return nav;
}
