'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { DiaryRow } from '@/types/contracts';
import { Sheet } from '@/components/ui';
import { REPORT_PATH } from '@/lib/navigation';
import { getEntry, getSummary } from '../logic/actions';
import { EntryForm } from './EntryForm';
import { mergePage, sortRows, matchesFilter } from './model';
import type { DiaryScreen, WorkDaysState } from './types';

type Ctx = {
  openNew: () => void; openEdit: (row: DiaryRow) => void;
  rows: DiaryRow[]; cursor: string | null;
  workDays?: WorkDaysState;
  appendPage: (items: DiaryRow[], next: string | null) => void;
  remove: (id: string) => void; reload: () => void;
};
const DiaryContext = createContext<Ctx | null>(null);
export const useDiary = () => { const c = useContext(DiaryContext); if (!c) throw new Error('DiaryProvider missing'); return c; };

/**
 * The one entry window of both layouts: the shared sheet (bottom sheet on the phone, centred window on desktop),
 * as in finance. `startOpen` is for /diary/new (the phone's report button): the list is behind it and closing returns to `closeHref`.
 */
export function DiaryProvider({ screen, startOpen, closeHref, children }: { screen: DiaryScreen; startOpen?: boolean; closeHref?: string; children: ReactNode }) {
  const router = useRouter();
  const currentScreen = useRef(screen);
  useEffect(() => { currentScreen.current = screen; }, [screen]);
  // Each mutation invalidates the complete aggregate, including dates on unloaded pages.
  // State is tied to the server screen and request version: an old filter/request cannot win a race.
  const [refresh, setRefresh] = useState<{ screen: DiaryScreen; version: number } | null>(null);
  const [summary, setSummary] = useState<{ screen: DiaryScreen; version: number; state: WorkDaysState } | null>(null);
  const refreshSummary = () => {
    const latest = currentScreen.current;
    if (latest.fixedProjectId) setRefresh(cur => ({ screen: latest, version: (cur?.version ?? 0) + 1 }));
  };
  useEffect(() => {
    if (!screen.fixedProjectId || !refresh || refresh.screen !== screen) return;
    let live = true;
    const request = refresh;
    const input = {
      projectId: screen.fixedProjectId,
      ...(screen.filter.from ? { from: screen.filter.from } : {}),
      ...(screen.filter.to ? { to: screen.filter.to } : {}),
    };
    const apply = (state: WorkDaysState) => { if (live) setSummary({ screen, version: request.version, state }); };
    getSummary(input).then(r => apply(r.ok ? { status: 'ready', count: r.value.workDays } : { status: 'error' }))
      .catch(() => apply({ status: 'error' }));
    return () => { live = false; };
  }, [screen, refresh]);
  const workDays: WorkDaysState | undefined = !screen.fixedProjectId ? undefined
    : refresh?.screen === screen
      ? summary?.screen === screen && summary.version === refresh.version ? summary.state : { status: 'loading' }
      : screen.workDays ?? { status: 'error' };
  // The one list of both layouts. A save puts the saved report into it at once; the page is never reloaded for that.
  const [seen, setSeen] = useState(screen.rows);
  const [rows, setRows] = useState(screen.rows);
  const [cursor, setCursor] = useState(screen.nextCursor);
  if (seen !== screen.rows) { setSeen(screen.rows); setRows(screen.rows); setCursor(screen.nextCursor); }
  const [dialog, setDialog] = useState<{ row: DiaryRow | null } | null>(startOpen && screen.canReport ? { row: null } : null);
  // The list is already on screen behind the window, so closing only fixes the address bar (no navigation, no reload).
  // Next's router follows history.replaceState, so a later refresh or link click still behaves.
  const close = () => { setDialog(null); if (closeHref) window.history.replaceState(null, '', closeHref); };
  const done = async (id: string) => {
    close();
    refreshSummary();
    try {
      const r = await getEntry({ id });
      if (currentScreen.current !== screen) return;
      if (!r.ok) { router.refresh(); return; }
      const entry = r.value;
      setRows(cur => {
        const rest = cur.filter(x => x.id !== id);
        return matchesFilter(entry, screen.filter) && !entry.cancelledAt ? sortRows([...rest, entry]) : rest;
      });
    } catch { if (currentScreen.current === screen) router.refresh(); }
  };
  const value: Ctx = {
    openNew: () => setDialog({ row: null }), openEdit: row => setDialog({ row }),
    workDays,
    rows, cursor, appendPage: (items, next) => { setRows(cur => mergePage(cur, items)); setCursor(next); },
    remove: id => { setRows(cur => cur.filter(x => x.id !== id)); refreshSummary(); }, reload: () => router.refresh(),
  };
  // The menu's report button points at /diary/new. While the diary is on screen it just opens the window here:
  // no navigation, and it works after the window was closed (the router thinks it is already on that address).
  const canReport = screen.canReport;
  useEffect(() => {
    if (!canReport) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link || link.getAttribute('target') === '_blank') return;
      const url = new URL((link as HTMLAnchorElement).href, location.href);
      // The general button, or the project button pointing at the project diary that is already on screen.
      if (url.pathname !== REPORT_PATH && !(url.pathname === location.pathname && url.searchParams.get('new') === '1')) return;
      e.preventDefault();
      e.stopPropagation();
      setDialog({ row: null });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [canReport]);
  const row = dialog?.row ?? null;
  return (
    <DiaryContext.Provider value={value}>
      {children}
      <Sheet open={dialog !== null} onClose={close} title={row ? 'עריכת דיווח' : 'דיווח חדש'}>
        {dialog && (
          <EntryForm key={row?.id ?? 'new'} entry={row ?? undefined} projects={screen.formProjects} canMove={screen.isOwner && (row?.canMoveOrCancel ?? false)}
            today={screen.today} initialProjectId={screen.fixedProjectId} onDone={done} onCancel={close} />
        )}
      </Sheet>
    </DiaryContext.Provider>
  );
}
