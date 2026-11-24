'use client';
import { useState } from 'react';
import type { AccessCandidate, DocumentAccess, DocumentCategory, FileRef } from '@/types/contracts';
import { Button, Notice } from '@/components/ui';
import { FileUpload } from '@/components/upload/FileUpload';
import { formatSize } from '@/components/upload/rules';
import { AccessPicker } from './AccessPicker';
import { CATEGORIES, emptyAccess, parseAccess, type AccessDraft } from './model';

/**
 * Upload sheet body. Category and access are chosen first (access has no default, also for the uploading manager);
 * the picker stays locked until both are valid. Files that uploaded but could not be saved stay listed for a retry.
 */
export function UploadForm({ projectId, initialCategory, candidates, pending, busy, error, onUploaded, onSave, onClose }: {
  projectId: string; initialCategory: DocumentCategory | null; candidates: AccessCandidate[];
  pending: FileRef[]; busy: boolean; error: string | null;
  onUploaded: (files: FileRef[], category: DocumentCategory, access: DocumentAccess) => void;
  onSave: () => void; onClose: () => void;
}) {
  const [category, setCategory] = useState<DocumentCategory | null>(initialCategory);
  const [draft, setDraft] = useState<AccessDraft>(emptyAccess);
  const parsed = parseAccess(draft, candidates);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ready = category !== null && parsed.ok;
  return (
    <div className="fl-form">
      <fieldset className="fl-access" disabled={busy || pending.length > 0}>
        <legend className="ui-field__label">קטגוריה</legend>
        <div className="fl-cats">
          {CATEGORIES.map(c => (
            <label key={c.key} className="fl-pill">
              <input type="radio" name="fl-cat" checked={category === c.key} onChange={() => setCategory(c.key)} />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <AccessPicker draft={draft} candidates={candidates} disabled={busy || uploading || pending.length > 0} error={touched && !parsed.ok ? parsed.error : null}
        onChange={next => { setTouched(true); setDraft(next); }} />
      {pending.length > 0 ? (
        <>
          <Notice tone="error">{error ?? 'הקבצים הועלו אך עדיין לא נשמרו.'}</Notice>
          <ul className="upload__list">
            {pending.map(f => <li key={f.id} className="upload__item"><div className="upload__name"><span className="ltr">{f.name}</span><div className="upload__meta">{formatSize(f.sizeBytes)}</div></div></li>)}
          </ul>
          <div className="ui-actions ui-actions--sheet">
            <Button disabled={busy} onClick={onSave}>{busy ? 'שומר…' : 'שמירה מחדש'}</Button>
            <Button variant="secondary" disabled={busy} onClick={onClose}>סגירה</Button>
          </div>
        </>
      ) : (
        <>
          {!ready && <p className="fl-lock">יש לבחור קטגוריה ולהגדיר מי רשאי לראות את המסמך. הקובץ יעלה ויישמר מיד כשייבחר.</p>}
          <FileUpload purpose="document" projectId={projectId} label="בחירת קבצים" disabled={!ready} onBusyChange={setUploading}
            onUploaded={files => { if (category && parsed.ok) onUploaded(files, category, parsed.access); }} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="ui-actions ui-actions--sheet"><Button variant="secondary" disabled={uploading} onClick={onClose}>סגירה</Button></div>
        </>
      )}
    </div>
  );
}
