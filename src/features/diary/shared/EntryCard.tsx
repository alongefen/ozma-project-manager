'use client';
import type { DiaryRow } from '@/types/contracts';
import { Card, DeleteIcon, EditIcon, ExportIcon, IconButton, PrintIcon } from '@/components/ui';
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
        <IconButton label="הדפסת הדיווח" href={reportUrl({ kind: 'entry', entryId: row.id })} target="_blank" rel="noopener noreferrer"><PrintIcon /></IconButton>
        <IconButton label="ייצוא הדיווח ל-PDF" href={reportUrl({ kind: 'entry', entryId: row.id }, { download: true })}><ExportIcon /></IconButton>
        {row.canMoveOrCancel && onCancel && <IconButton tone="danger" label="ביטול הדיווח" onClick={() => onCancel(row)}><DeleteIcon /></IconButton>}
        {row.canCorrect && onEdit && <IconButton label="עריכת הדיווח" onClick={() => onEdit(row)}><EditIcon /></IconButton>}
      </div>
    </Card>
  );
}
