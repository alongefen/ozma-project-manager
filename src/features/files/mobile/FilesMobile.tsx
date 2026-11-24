'use client';
import { Button, Notice, Pin } from '@/components/ui';
import { DocList } from '../shared/DocList';
import { DocTools } from '../shared/DocTools';
import { useFiles } from '../shared/FilesProvider';
import { CATEGORIES, categoryLabel } from '../shared/model';

/** Phone: categories screen, then the files of one category (back is a button, not a tab bar). Access opens as a full sheet. */
export function FilesMobile() {
  const { category, setCategory, counts, canUpload, openUpload } = useFiles();
  return (
    <div className="fl fl-mobile m-only">
      {canUpload ? <Pin><Button block onClick={openUpload}>העלאת מסמך</Button></Pin> : <Notice>אין הרשאה להעלות מסמכים כאן. אפשר לפתוח ולהוריד.</Notice>}
      {category === null ? (
        <section className="fl-group" aria-labelledby="fl-m-cats">
          <h2 id="fl-m-cats" className="fl-group__title">קטגוריות</h2>
          <ul className="fl-catlist">
            {CATEGORIES.map(c => (
              <li key={c.key}>
                <button type="button" className="fl-cat" onClick={() => setCategory(c.key)}>
                  <span>{c.label}</span><span className="fl-count">{counts[c.key]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="fl-group" aria-labelledby="fl-m-files">
          <Button variant="secondary" onClick={() => setCategory(null)}>חזרה לקטגוריות</Button>
          <h2 id="fl-m-files" className="fl-group__title">{categoryLabel(category)} <span className="fl-count">{counts[category]}</span></h2>
          <DocTools />
          <DocList />
        </section>
      )}
    </div>
  );
}
