'use client';
import { createContext, useContext, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { FinanceFilter, TransactionRow } from '@/types/contracts';
import { allFinanceHref, financeHref } from './query';

type Nav = {
  /** What the screen shows right now: the chosen period and the day/search as typed, before the server has answered. */
  filter: FinanceFilter;
  go(next: FinanceFilter): void;
  /** True while a period change is being loaded. */
  loading: boolean;
  /** True when the server-calculated totals of the shown rows match the day/search currently shown. */
  totalsReady: boolean;
  /** Set only on the all-projects page: the project choices, the project of each row, and the chosen project. */
  all: AllScope | null;
  /** Narrows the all-projects page to one project (null = all). A server round trip, like a period change. */
  goProject(project: string | null): void;
  /** Applies a whole filter and the project in one navigation (the phone's filter window). */
  goWith(next: FinanceFilter, project: string | null): void;
  /** The project a row belongs to (the page's project, or the row's own on the all-projects page). */
  rowProjectId(rowId: string): string;
  /** False for a row of a finished or archived project on the all-projects page: it can be neither edited nor cancelled. */
  rowOpen(rowId: string): boolean;
  /** The address of this screen for a filter (project page or all-projects page). */
  href(next: FinanceFilter): string;
};
export type AllScope = {
  projects: { id: string; name: string; open: boolean }[];
  projectOf: Record<string, string>;
  projectIdOf: Record<string, string>;
  /** Cancelled rows of the shown period, for permanent delete. */
  cancelled: TransactionRow[];
  project: string | null;
};
const Ctx = createContext<Nav | null>(null);
const periodKey = (p: FinanceFilter['period']) => (p === 'all' ? 'all' : `${p.year}-${p.month}`);

/**
 * Filter state with instant feedback. Day and search narrow the rows already on the screen at once
 * (the rows of the whole period are loaded); the server is asked in the background only for the
 * calculated totals of those rows. A period change loads new rows, so it shows the choice at once and dims
 * the content until the server answers.
 */
export function FinanceNavProvider({ projectId, all = null, filter: serverFilter, children }: { projectId?: string; all?: AllScope | null; filter: FinanceFilter; children: ReactNode }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [period, setPeriod] = useOptimistic(serverFilter.period);
  const [project, setProject] = useOptimistic(all?.project ?? null);
  const [local, setLocal] = useState({ day: serverFilter.day, search: serverFilter.search });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const shown: FinanceFilter = { period, ...(local.day !== undefined ? { day: local.day } : {}), ...(local.search ? { search: local.search } : {}) };
  const loading = periodKey(period) !== periodKey(serverFilter.period) || project !== (all?.project ?? null);
  const totalsReady = (local.day ?? null) === (serverFilter.day ?? null) && (local.search?.trim() ?? '') === (serverFilter.search ?? '');

  const hrefFor = (next: FinanceFilter, chosen: string | null = project) => (all ? allFinanceHref(next, chosen) : financeHref(projectId ?? '', next));

  function goProject(next: string | null) {
    const target: FinanceFilter = { period, ...(local.day !== undefined ? { day: local.day } : {}), ...(local.search ? { search: local.search } : {}) };
    start(() => { setProject(next); router.push(hrefFor(target, next)); });
  }

  function goWith(next: FinanceFilter, chosen: string | null) {
    setLocal({ day: next.day, search: next.search });
    clearTimeout(timer.current);
    start(() => { setPeriod(next.period); if (all) setProject(chosen); router.push(hrefFor(next, all ? chosen : null)); });
  }

  function go(next: FinanceFilter) {
    const href = hrefFor(next);
    setLocal({ day: next.day, search: next.search });
    clearTimeout(timer.current);
    if (periodKey(next.period) !== periodKey(period)) {
      start(() => { setPeriod(next.period); router.push(href); });
    } else {
      timer.current = setTimeout(() => start(() => router.replace(href, { scroll: false })), next.search === local.search ? 0 : 300);
    }
  }

  return (
    <Ctx.Provider value={{ filter: shown, go, loading, totalsReady, all: all && { ...all, project }, goProject, goWith, href: next => hrefFor(next),
      rowProjectId: id => (all ? all.projectIdOf[id] ?? '' : projectId ?? ''),
      rowOpen: id => !all || !!all.projects.find(p => p.id === all.projectIdOf[id])?.open }}>
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
