'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { DiaryRow } from '@/types/contracts';
import { Sheet } from '@/components/ui';
import { REPORT_PATH } from '@/lib/navigation';
import { getEntry } from '../logic/actions';
import { EntryForm } from './EntryForm';
import { mergePage, sortRows, matchesFilter } from './model';
import type { DiaryScreen } from './types';

type Ctx = {
  openNew: () => void; openEdit: (row: DiaryRow) => void;
  rows: DiaryRow[]; cursor: string | null;
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
    try {
      const r = await getEntry({ id });
      if (!r.ok) { router.refresh(); return; }
      const entry = r.value;
      setRows(cur => {
        const rest = cur.filter(x => x.id !== id);
        return matchesFilter(entry, screen.filter) && !entry.cancelledAt ? sortRows([...rest, entry]) : rest;
      });
    } catch { router.refresh(); }
  };
  const value: Ctx = {
    openNew: () => setDialog({ row: null }), openEdit: row => setDialog({ row }),
    rows, cursor, appendPage: (items, next) => { setRows(cur => mergePage(cur, items)); setCursor(next); },
    remove: id => setRows(cur => cur.filter(x => x.id !== id)), reload: () => router.refresh(),
  };
  // The menu's report button points at /diary/new. While the diary is on screen it just opens the window here:
  // no navigation, and it works after the window was closed (the router thinks it is already on that address).
  const canReport = screen.canReport;
  useEffect(() => {
    if (!canReport) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link || link.getAttribute('target') === '_blank' || new URL((link as HTMLAnchorElement).href, location.href).pathname !== REPORT_PATH) return;
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
