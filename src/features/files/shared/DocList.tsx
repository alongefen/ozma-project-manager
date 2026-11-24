'use client';
import { DocCard } from './DocCard';
import { useFiles } from './FilesProvider';

export function DocList() {
  const { shown, search, showArchived, isOwner } = useFiles();
  if (shown.length === 0) {
    return <p className="fl-empty">{search.trim() ? 'לא נמצאו מסמכים לחיפוש הזה' : showArchived ? 'אין מסמכים בארכיון' : 'עוד אין מסמכים להצגה'}</p>;
  }
  return (
    <div className={`fl-table${isOwner ? ' is-owner' : ''}`}>
      <div className="fl-row fl-row--head d-only" aria-hidden="true">
        <span /><span>שם</span><span>סוג וגודל</span><span>הועלה</span>{isOwner && <span>גישה</span>}<span />
      </div>
      <ul className="fl-rows">{shown.map(d => <DocCard key={d.id} doc={d} />)}</ul>
    </div>
  );
}
