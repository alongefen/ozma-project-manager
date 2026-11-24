'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { DiaryRow } from '@/types/contracts';
import { Sheet } from '@/components/ui';
import { EntryForm } from './EntryForm';
import type { DiaryScreen } from './types';

type Ctx = { openNew: () => void; openEdit: (row: DiaryRow) => void };
const DiaryContext = createContext<Ctx | null>(null);
export const useDiary = () => { const c = useContext(DiaryContext); if (!c) throw new Error('DiaryProvider missing'); return c; };

/**
 * The one entry window of both layouts: the shared sheet (bottom sheet on the phone, centred window on desktop),
 * as in finance. `startOpen` is for /diary/new (the phone's report button): the list is behind it and closing returns to `closeHref`.
 */
export function DiaryProvider({ screen, startOpen, closeHref, children }: { screen: DiaryScreen; startOpen?: boolean; closeHref?: string; children: ReactNode }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ row: DiaryRow | null } | null>(startOpen && screen.canReport ? { row: null } : null);
  // The list is already on screen behind the window, so closing only fixes the address bar (no navigation, no reload).
  // Next's router follows history.replaceState, so a later refresh or link click still behaves.
  const close = () => { setDialog(null); if (closeHref) window.history.replaceState(null, '', closeHref); };
  const done = () => { close(); router.refresh(); };
  const value: Ctx = { openNew: () => setDialog({ row: null }), openEdit: row => setDialog({ row }) };
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
