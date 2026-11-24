'use client';
import { SelectField, TextField } from '@/components/ui';
import { useFiles } from './FilesProvider';
import { CATEGORIES } from './model';

/**
 * The filter row of the documents screen, the same pattern as the other screens: search and filters first,
 * and the archive as a button at the end of the same row (owner only). The data list sits beneath it.
 */
export function DocTools() {
  const { search, setSearch, category, setCategory, counts, isOwner, showArchived, setShowArchived, archivedCount } = useFiles();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const options = [{ value: '', label: `הכל (${total})` }, ...CATEGORIES.map(c => ({ value: c.key, label: `${c.label} (${counts[c.key]})` }))];
  return (
    <div className="fl-tools" role="search" aria-label="סינון מסמכים">
      <div className="fl-tools__search"><TextField label="חיפוש לפי שם קובץ" hideLabel type="search" placeholder="חיפוש לפי שם קובץ" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <SelectField className="fl-tools__category" aria-label="קטגוריה" value={category ?? ''} onChange={v => setCategory(v === '' ? null : CATEGORIES.find(c => c.key === v)?.key ?? null)} options={options} />
      {isOwner && (
        <button type="button" className={`ui-btn ui-btn--secondary fl-tools__archive${showArchived ? ' is-on' : ''}`} aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}>
          לארכיון<span className="fl-count">{archivedCount}</span>
        </button>
      )}
    </div>
  );
}
