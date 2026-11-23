'use client';
import { createContext, useContext, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { FinanceFilter } from '@/types/contracts';
import { financeHref } from './query';

type Nav = {
  /** What the screen shows right now: the chosen period and the day/search as typed, before the server has answered. */
  filter: FinanceFilter;
  go(next: FinanceFilter): void;
  /** True while a period change is being loaded. */
  loading: boolean;
  /** True when the server-calculated totals of the shown rows match the day/search currently shown. */
  totalsReady: boolean;
};
const Ctx = createContext<Nav | null>(null);
const periodKey = (p: FinanceFilter['period']) => (p === 'all' ? 'all' : `${p.year}-${p.month}`);

/**
 * Filter state with instant feedback. Day and search narrow the rows already on the screen at once
 * (the rows of the whole period are loaded); the server is asked in the background only for the
 * calculated totals of those rows. A period change loads new rows, so it shows the choice at once and dims
 * the content until the server answers.
 */
export function FinanceNavProvider({ projectId, filter: serverFilter, children }: { projectId: string; filter: FinanceFilter; children: ReactNode }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [period, setPeriod] = useOptimistic(serverFilter.period);
  const [local, setLocal] = useState({ day: serverFilter.day, search: serverFilter.search });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const shown: FinanceFilter = { period, ...(local.day !== undefined ? { day: local.day } : {}), ...(local.search ? { search: local.search } : {}) };
  const loading = periodKey(period) !== periodKey(serverFilter.period);
  const totalsReady = (local.day ?? null) === (serverFilter.day ?? null) && (local.search?.trim() ?? '') === (serverFilter.search ?? '');

  function go(next: FinanceFilter) {
    const href = financeHref(projectId, next);
    setLocal({ day: next.day, search: next.search });
    clearTimeout(timer.current);
    if (periodKey(next.period) !== periodKey(period)) {
      start(() => { setPeriod(next.period); router.push(href); });
    } else {
      timer.current = setTimeout(() => start(() => router.replace(href, { scroll: false })), next.search === local.search ? 0 : 300);
    }
  }

  return (
    <Ctx.Provider value={{ filter: shown, go, loading, totalsReady }}>
      <div className="fin-wrap" data-pending={loading || undefined} aria-busy={loading}>
        {loading && <div className="fin-progress" role="status"><span className="sr-only">טוען…</span></div>}
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
