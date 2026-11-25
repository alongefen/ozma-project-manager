'use client';
import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AccessCandidate, DocumentAccess, DocumentCategory, DocumentRow, FileRef, Result } from '@/types/contracts';
import { ConfirmDialog, Notice, Sheet } from '@/components/ui';
import { createDocument, setDocumentAccess, setDocumentArchived } from '../logic/actions';
import { HardDeleteDialog } from '@/features/projects/shared/HardDelete';
import { AccessForm } from './AccessForm';
import { UploadForm } from './UploadForm';
import { countsOf, visibleDocuments } from './model';

type Props = {
  projectId: string; active: DocumentRow[]; archived: DocumentRow[]; candidates: AccessCandidate[]; admins?: string[];
  canUpload: boolean; isOwner: boolean; children?: ReactNode;
};
type Ctx = {
  canUpload: boolean; isOwner: boolean; candidates: AccessCandidate[]; showArchived: boolean;
  counts: Record<DocumentCategory, number>; shown: DocumentRow[]; archivedCount: number;
  category: DocumentCategory | null; search: string;
  setCategory: (c: DocumentCategory | null) => void; setSearch: (s: string) => void; setShowArchived: (v: boolean) => void;
  openUpload: () => void; openAccess: (d: DocumentRow) => void; askArchive: (d: DocumentRow) => void; askDelete: (d: DocumentRow) => void;
};
const FilesContext = createContext<Ctx | null>(null);
export const useFiles = () => { const c = useContext(FilesContext); if (!c) throw new Error('FilesProvider missing'); return c; };

const unavailable = { ok: false, error: { code: 'UNAVAILABLE', message: 'הפעולה לא הושלמה. יש לנסות שוב' } } as Result<unknown>;
async function guarded(action: () => Promise<Result<unknown>>): Promise<Result<unknown>> {
  try { return await action(); } catch { return unavailable; }
}

/**
 * One state for both layouts. Documents are loaded in full, so category, search and the archive view are
 * client-side; every write goes through a server action and the page refreshes afterwards.
 */
export function FilesProvider({ projectId, active, archived, candidates, admins, canUpload, isOwner, children }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [category, setCategory] = useState<DocumentCategory | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [upload, setUpload] = useState<{ category: DocumentCategory | null } | null>(null);
  const [pending, setPending] = useState<{ files: FileRef[]; category: DocumentCategory; access: DocumentAccess } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentRow | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [archiveDoc, setArchiveDoc] = useState<DocumentRow | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentRow | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);
  const refresh = () => startTransition(() => router.refresh());

  const source = showArchived ? archived : active;
  const value: Ctx = {
    canUpload, isOwner, candidates, showArchived, category, search, archivedCount: archived.length,
    counts: countsOf(source), shown: visibleDocuments(source, category, search),
    setCategory, setSearch, setShowArchived,
    openUpload: () => { setUploadError(null); setUpload({ category: pending?.category ?? category }); },
    openAccess: d => { setAccessError(null); setAccessDoc(d); },
    askArchive: d => { setArchiveError(null); setArchiveDoc(d); },
    askDelete: d => setDeleteDoc(d),
  };

  // Saves every uploaded file; the ones the server refused stay in `pending` for a retry (an uploaded file can be used once).
  async function save(files: FileRef[], cat: DocumentCategory, access: DocumentAccess) {
    setUploadBusy(true); setUploadError(null);
    const failed: FileRef[] = [];
    let message: string | null = null;
    for (const file of files) {
      const result = await guarded(() => createDocument({ projectId, fileId: file.id, category: cat, access }));
      if (!result.ok) { failed.push(file); message = result.error.message; }
    }
    setUploadBusy(false);
    if (failed.length > 0) { setPending({ files: failed, category: cat, access }); setUploadError(message); }
    else { setPending(null); setUpload(null); setCategory(cat); }
    refresh();
  }

  async function saveAccess(access: DocumentAccess) {
    if (!accessDoc) return;
    const doc = accessDoc;
    setAccessBusy(true); setAccessError(null);
    const result = await guarded(() => setDocumentAccess({ id: doc.id, expectedRevision: doc.revision, access }));
    setAccessBusy(false);
    if (!result.ok) {
      setAccessError(result.error.message);
      if (result.error.code === 'CONFLICT') { setAccessDoc(null); setToast(result.error.message); refresh(); }
      return;
    }
    setAccessDoc(null);
    refresh();
  }

  async function confirmArchive() {
    if (!archiveDoc) return;
    const doc = archiveDoc;
    setArchiveBusy(true); setArchiveError(null);
    const result = await guarded(() => setDocumentArchived({ id: doc.id, expectedRevision: doc.revision, archived: !doc.archived }));
    setArchiveBusy(false);
    if (!result.ok) {
      if (result.error.code === 'CONFLICT') { setArchiveDoc(null); setToast(result.error.message); refresh(); return; }
      setArchiveError(result.error.message); return;
    }
    setArchiveDoc(null);
    refresh();
  }

  return (
    <FilesContext.Provider value={value}>
      <div className="fl-root">
        {toast && <Notice tone="error">{toast}</Notice>}
        {children}
      </div>
      <Sheet open={upload !== null} onClose={() => setUpload(null)} dismissible={!uploadBusy} title="העלאת מסמך">
        {upload && (
          <UploadForm projectId={projectId} initialCategory={upload.category} candidates={candidates} admins={admins}
            pending={pending?.files ?? []} busy={uploadBusy} error={uploadError}
            onUploaded={(files, cat, access) => { void save(files, cat, access); }}
            onSave={() => { if (pending) void save(pending.files, pending.category, pending.access); }}
            onClose={() => setUpload(null)} />
        )}
      </Sheet>
      <Sheet open={accessDoc !== null} onClose={() => setAccessDoc(null)} dismissible={!accessBusy} title="הרשאות צפייה במסמך">
        {accessDoc && <AccessForm doc={accessDoc} candidates={candidates} admins={admins} busy={accessBusy} error={accessError} onSubmit={access => { void saveAccess(access); }} onCancel={() => setAccessDoc(null)} />}
      </Sheet>
      <ConfirmDialog open={archiveDoc !== null} title={archiveDoc?.archived ? 'החזרת מסמך' : 'העברת מסמך לארכיון'}
        confirmLabel={archiveDoc?.archived ? 'החזרה' : 'העברה לארכיון'} busyLabel="מבצע…" busy={archiveBusy} error={archiveError} danger={!archiveDoc?.archived}
        onConfirm={() => { void confirmArchive(); }} onCancel={() => setArchiveDoc(null)}>
        <p>{archiveDoc?.archived ? 'המסמך יחזור לרשימה, עם ההרשאות שהיו לו.' : 'המסמך יוסתר מהרשימה. שום דבר לא נמחק, ואפשר להחזיר אותו מהארכיון.'}</p>
      </ConfirmDialog>
      {deleteDoc && <HardDeleteDialog kind="document" id={deleteDoc.id} open onClose={() => setDeleteDoc(null)} onDone={note => { setDeleteDoc(null); if (note) setToast(note); refresh(); }} />}
    </FilesContext.Provider>
  );
}
