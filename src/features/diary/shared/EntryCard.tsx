'use client';
import Link from 'next/link';
import type { DiaryRow } from '@/types/contracts';
import { Button, Card } from '@/components/ui';
import { format } from '@/lib/format';
import { editedText, fileUrl, isImage, reportUrl } from './model';

/** One report: who wrote it and when (server time), the text, attachments, and only the actions the server allows. */
export function EntryCard({ row, showProject, onCancel }: { row: DiaryRow; showProject: boolean; onCancel?: (row: DiaryRow) => void }) {
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
      {row.files.length > 0 && (
        <ul className="dr-files">
          {row.files.map(f => (
            <li key={f.id}>
              <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="dr-file">
                {isImage(f.mime) ? '🖼' : '📄'} <span className="ltr">{f.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="dr-card__actions">
        <a className="ui-btn ui-btn--secondary ui-btn--small" href={reportUrl({ kind: 'entry', entryId: row.id })} target="_blank" rel="noopener noreferrer">הדפסה / PDF</a>
        {row.canCorrect && <Link className="ui-btn ui-btn--secondary ui-btn--small" href={`/diary/${row.id}/edit`}>עריכה</Link>}
        {row.canMoveOrCancel && onCancel && <Button variant="secondary" size="small" onClick={() => onCancel(row)}>ביטול דיווח</Button>}
      </div>
    </Card>
  );
}
