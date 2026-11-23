'use client';
import { Button, Card, Notice } from '@/components/ui';
import { DocList } from '../shared/DocList';
import { DocTools } from '../shared/DocTools';
import { useFiles } from '../shared/FilesProvider';
import { CATEGORIES } from '../shared/model';

/** Desktop (from 1024): category column beside the list, search above it. Access is a centred window. */
export function FilesDesktop() {
  const { category, setCategory, counts, canUpload, openUpload } = useFiles();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items = [{ key: null, label: 'הכל', count: total }, ...CATEGORIES.map(c => ({ key: c.key, label: c.label, count: counts[c.key] }))];
  return (
    <div className="fl fl-desktop d-only">
      <div className="fl-bar">
        <h2 className="fl-bar__title">מסמכים</h2>
        {canUpload && <Button onClick={openUpload}>+ העלאת מסמך</Button>}
      </div>
      {!canUpload && <Notice>הפרויקט זמין לצפייה והדפסה בלבד.</Notice>}
      <div className="fl-split">
        <Card panel>
          <ul className="fl-catlist" aria-label="קטגוריות">
            {items.map(i => (
              <li key={i.key ?? 'all'}>
                <button type="button" className="fl-cat" aria-pressed={category === i.key} onClick={() => setCategory(i.key)}>
                  <span>{i.label}</span><span className="fl-count">{i.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card panel><DocTools /><DocList /></Card>
      </div>
    </div>
  );
}
