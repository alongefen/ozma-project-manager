'use client';
import { useEffect, useState } from 'react';
import { ConfirmDialog, Notice, TextField } from '@/components/ui';
import { hardDelete, previewHardDelete } from '../logic/actions';
import type { Preview } from '../logic/hard-delete';
import { AFTER_DELETE_NOTE, IRREVERSIBLE, deletionSummary, nameMatches, type HardKind } from './hard-delete-model';

/**
 * The confirmation window of "מחיקה סופית" (A-44). The caller renders the trigger (visible to owner-level accounts, on
 * cancelled/archived items only) and mounts this with `open`. Counts come from the server; a name is typed for a
 * project and for anything with files. The server refuses everyone else, and active items, regardless of this screen.
 */
export function HardDeleteDialog({ kind, id, open, onClose, onDone }: { kind: HardKind; id: string; open: boolean; onClose: () => void; onDone: (note: string | null) => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void previewHardDelete({ kind, id }).then(r => { if (!live) return; if (r.ok) setPreview(r.value); else setError(r.error.message); });
    return () => { live = false; };
  }, [open, kind, id]);

  async function confirm() {
    if (!preview) return;
    if (!preview.eligible) { setError('אפשר למחוק סופית רק פריט שבוטל או הועבר לארכיון.'); return; }
    if (preview.requiresName && !nameMatches(typed, preview.confirmName)) { setError('השם שהוקלד לא תואם.'); return; }
    setBusy(true); setError(null);
    const result = await hardDelete({ kind, id, ...(preview.requiresName ? { confirmName: typed.trim() } : {}) });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    onDone(result.value.storagePending > 0 ? AFTER_DELETE_NOTE : null);
  }

  return (
    <ConfirmDialog open={open} title="מחיקה סופית" confirmLabel="מחיקה סופית" busyLabel="מוחק…" busy={busy} error={error} danger
      onConfirm={() => { void confirm(); }} onCancel={onClose}>
      {!preview && !error && <p>בודק מה יימחק…</p>}
      {preview && (
        <>
          {deletionSummary(kind, preview.name, preview.counts).map((line, i) => <p key={i}>{line}</p>)}
          <Notice tone="error">{IRREVERSIBLE}</Notice>
          {preview.requiresName && <TextField label={`להמשך, יש להקליד: ${preview.confirmName ?? ''}`} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />}
        </>
      )}
    </ConfirmDialog>
  );
}
