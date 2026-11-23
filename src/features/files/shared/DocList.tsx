'use client';
import { DocCard } from './DocCard';
import { useFiles } from './FilesProvider';

export function DocList() {
  const { shown, search, showArchived } = useFiles();
  if (shown.length === 0) {
    return <p className="fl-empty">{search.trim() ? 'לא נמצאו מסמכים לחיפוש הזה' : showArchived ? 'אין מסמכים בארכיון' : 'עוד אין מסמכים בקטגוריה הזאת'}</p>;
  }
  return <ul className="fl-list">{shown.map(d => <DocCard key={d.id} doc={d} />)}</ul>;
}
