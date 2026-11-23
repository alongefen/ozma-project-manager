'use client';
import { TextField } from '@/components/ui';
import { useFiles } from './FilesProvider';

/** Search by file name and, for the owner, the archive view. */
export function DocTools() {
  const { search, setSearch, isOwner, showArchived, setShowArchived, archivedCount } = useFiles();
  return (
    <div className="fl-tools">
      <TextField label="חיפוש לפי שם קובץ" type="search" value={search} onChange={e => setSearch(e.target.value)} />
      {isOwner && (
        <label className="fl-check">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          <span>הצגת הארכיון ({archivedCount})</span>
        </label>
      )}
    </div>
  );
}
