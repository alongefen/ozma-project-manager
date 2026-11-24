'use client';
import type { DiaryRow } from '@/types/contracts';
import { Card } from '@/components/ui';
import { PencilIcon, PrintIcon, TrashIcon } from './DiaryIcons';
import { format } from '@/lib/format';
import { Attachments } from './Attachments';
import { editedText, reportUrl } from './model';

/** One report: who wrote it and when (server time), the text, attachments, and only the actions the server allows. */
export function EntryCard({ row, showProject, onEdit, onCancel }: { row: DiaryRow; showProject: boolean; onEdit?: (row: DiaryRow) => void; onCancel?: (row: DiaryRow) => void }) {
  const edited = editedText(row);
  return (
    <Card className="dr-card" data-testid="diary-entry">
      <div className="dr-card__head">
        <span className="dr-card__who">{row.reporterName}</span>
        <span className="dr-card__time">{format.dateTime(row.enteredAt)}</span>
      </div>
      {showProject && <p className="dr-card__project">{row.projectName}</p>}
      <p className="dr-card__body">{row.body}</p>
      {edited && <p className="dr-card__edited">{edited}</p>}
      <Attachments files={row.files} />
      <div className="dr-card__actions no-print">
        <a className="dr-iconbtn" href={reportUrl({ kind: 'entry', entryId: row.id })} target="_blank" rel="noopener noreferrer" aria-label="הדפסה או PDF של הדיווח" title="הדפסה / PDF"><PrintIcon /></a>
        {row.canMoveOrCancel && onCancel && <button type="button" className="dr-iconbtn dr-iconbtn--danger" onClick={() => onCancel(row)} aria-label="ביטול הדיווח" title="ביטול דיווח"><TrashIcon /></button>}
        {row.canCorrect && onEdit && <button type="button" className="dr-iconbtn" onClick={() => onEdit(row)} aria-label="עריכת הדיווח" title="עריכה"><PencilIcon /></button>}
      </div>
    </Card>
  );
}
