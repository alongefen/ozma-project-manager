'use client';
import type { DocumentRow } from '@/types/contracts';
import { Button } from '@/components/ui';
import { formatSize } from '@/components/upload/rules';
import { format } from '@/lib/format';
import { useFiles } from './FilesProvider';
import { accessSummary, categoryLabel, fileHref, kindLabel } from './model';

/** One document: name, meta, open and download (links to the signed-file route), owner-only access and archive. */
export function DocCard({ doc }: { doc: DocumentRow }) {
  const { isOwner, candidates, openAccess, askArchive } = useFiles();
  const summary = accessSummary(doc.access, candidates);
  return (
    <li className="fl-card">
      <div className="fl-card__main">
        <p className="fl-card__name ltr">{doc.file.name}</p>
        <p className="fl-card__meta">{categoryLabel(doc.category)} · {kindLabel(doc.file.mime)} · {formatSize(doc.file.sizeBytes)}</p>
        <p className="fl-card__meta">{doc.uploadedByName} · {format.date(doc.createdAt.slice(0, 10))}</p>
        {summary && <p className="fl-card__meta">גישה: {summary}</p>}
      </div>
      <div className="fl-card__actions">
        <a className="ui-btn" href={fileHref(doc.file.id, false)} target="_blank" rel="noopener noreferrer">פתיחה</a>
        <a className="ui-btn ui-btn--secondary" href={fileHref(doc.file.id, true)} download>הורדה</a>
        {isOwner && <Button variant="secondary" onClick={() => openAccess(doc)}>גישה</Button>}
        {isOwner && <Button variant="secondary" onClick={() => askArchive(doc)}>{doc.archived ? 'החזרה' : 'לארכיון'}</Button>}
      </div>
    </li>
  );
}
