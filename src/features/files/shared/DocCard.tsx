'use client';
import { useRef, useState } from 'react';
import type { DocumentRow } from '@/types/contracts';
import { Popup } from '@/components/ui/Popup';
import { formatSize } from '@/components/upload/rules';
import { format } from '@/lib/format';
import { canOfferHardDelete } from '@/features/projects/shared/hard-delete-model';
import { DocThumb } from './DocThumb';
import { useFiles } from './FilesProvider';
import { accessSummary, categoryLabel, fileHref, kindLabel } from './model';

/**
 * One document as a table row: preview, name (opens the file), type and size, uploader and date, access (owner),
 * and one "⋯" menu with every action (open, download; owner: access, archive or restore).
 */
export function DocCard({ doc }: { doc: DocumentRow }) {
  const { isOwner, candidates, openAccess, askArchive, askDelete } = useFiles();
  const summary = accessSummary(doc.access, candidates);
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closedAt = useRef(0);
  const done = () => { closedAt.current = performance.now(); setMenu(false); };
  return (
    <li className="fl-row">
      <DocThumb file={doc.file} />
      <div className="fl-row__main">
        <a className="fl-row__name ltr" href={fileHref(doc.file.id, false)} target="_blank" rel="noopener noreferrer">{doc.file.name}</a>
        <p className="fl-row__meta">{categoryLabel(doc.category)}</p>
      </div>
      <p className="fl-row__cell fl-row__kind">{kindLabel(doc.file.mime)} · {formatSize(doc.file.sizeBytes)}</p>
      <p className="fl-row__cell fl-row__by">{doc.uploadedByName} · {format.date(doc.createdAt.slice(0, 10))}</p>
      {isOwner && <p className="fl-row__cell fl-row__access">{summary ? `גישה: ${summary}` : ''}</p>}
      <div className="fl-row__menu">
        <button ref={trigger} type="button" className="fl-kebab" aria-label={`פעולות עבור ${doc.file.name}`} aria-haspopup="true" aria-expanded={menu} onClick={() => { if (menu) setMenu(false); else if (performance.now() - closedAt.current > 300) setMenu(true); }}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="5" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="19" r="1.8" fill="currentColor" /></svg>
        </button>
        <Popup open={menu} onClose={done} anchor={trigger} title="פעולות">
          <DocActions doc={doc} isOwner={isOwner} onDone={done} onAccess={() => openAccess(doc)} onArchive={() => askArchive(doc)} onDelete={() => askDelete(doc)} />
        </Popup>
      </div>
    </li>
  );
}

/** The "⋯" menu items. Open and download for everyone who can see the row; access and archive only for the owner. */
export function DocActions({ doc, isOwner, onDone, onAccess, onArchive, onDelete }: { doc: DocumentRow; isOwner: boolean; onDone: () => void; onAccess: () => void; onArchive: () => void; /** Permanent delete (A-44): owner, archived documents only. */ onDelete?: () => void }) {
  return (
    <div className="fl-menu">
      <a className="fl-menu__item" href={fileHref(doc.file.id, false)} target="_blank" rel="noopener noreferrer" onClick={onDone}>פתיחה</a>
      <a className="fl-menu__item" href={fileHref(doc.file.id, true)} download onClick={onDone}>הורדה</a>
      {isOwner && <button type="button" className="fl-menu__item" onClick={() => { onDone(); onAccess(); }}>הרשאות</button>}
      {isOwner && <button type="button" className="fl-menu__item" onClick={() => { onDone(); onArchive(); }}>{doc.archived ? 'החזרה' : 'העבר לארכיון'}</button>}
      {onDelete && canOfferHardDelete(isOwner, 'document', { archived: doc.archived }) && <button type="button" className="fl-menu__item" onClick={() => { onDone(); onDelete(); }}>מחיקה סופית</button>}
    </div>
  );
}
