import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { FileUpload } from '@/components/upload/FileUpload';
import { UploadForm } from '@/features/files/shared/UploadForm';

const noop = () => {};
describe('העלאה אוטומטית', () => {
  it('הבקרה המשותפת מציגה רק בחירת קובץ, בלי כפתור העלאה נפרד', () => {
    const html = renderToStaticMarkup(h(FileUpload, { purpose: 'diary', projectId: 'p', camera: true, onUploaded: noop }));
    expect(html).toContain('בחירת קבצים');
    expect(html).not.toContain('העלאה');
    expect(html).not.toContain('ממתין להעלאה');
  });
  it('טופס מסמך: הבחירה נעולה עד שנבחרו קטגוריה וגישה, ואין כפתור העלאה', () => {
    const html = renderToStaticMarkup(h(UploadForm, { projectId: 'p', initialCategory: null, candidates: [], pending: [], busy: false, error: null, onUploaded: noop, onSave: noop, onClose: noop }));
    expect(html).toContain('הקובץ יעלה ויישמר מיד');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>בחירת קבצים/);
    expect(html).not.toMatch(/>העלאה</);
  });
  it('הרכיב מתחיל להעלות בבחירה ומאפשר ניסיון חוזר באותו מזהה', () => {
    const src = readFileSync('src/components/upload/FileUpload.tsx', 'utf8');
    expect(src).toContain('void run(fresh)');
    expect(src).toContain('void run([item])');
    expect(src).toContain('clientId: i.key');
  });
});
