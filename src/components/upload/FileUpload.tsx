'use client';
import { useRef, useState } from 'react';
import { Upload } from 'tus-js-client';
import { Button, Notice } from '@/components/ui';
import type { FilePurpose, FileRef, Result, UploadTarget } from '@/types/contracts';
import { ACCEPTED_MIME, MAX_FILES, checkFile, formatSize } from './rules';

type Status = 'ready' | 'uploading' | 'done' | 'error';
type Item = { key: string; file: File; mime: string | null; status: Status; progress: number; error?: string; ref?: FileRef };

export type FileUploadProps = {
  purpose: FilePurpose;
  projectId: string;
  /** Called with every file that finished uploading and was accepted by the server. */
  onUploaded: (files: FileRef[]) => void;
  /** Show a "take a photo" button next to the file picker (phone camera). */
  camera?: boolean;
  label?: string;
  disabled?: boolean;
};

const newId = () => crypto.randomUUID();

async function post<T>(url: string, body?: unknown): Promise<Result<T>> {
  try {
    const response = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    return (await response.json()) as Result<T>;
  } catch {
    return { ok: false, error: { code: 'UNAVAILABLE', message: 'אין חיבור. נסו שוב' } };
  }
}

function sendTus(file: File, mime: string, t: Extract<UploadTarget['target'], { ok: true }>['value'], onProgress: (n: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const task = new Upload(file, {
      endpoint: t.endpoint,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000],
      uploadDataDuringCreation: false,
      removeFingerprintOnSuccess: true,
      headers: { apikey: t.publishableKey, 'x-signature': t.token },
      metadata: { bucketName: t.bucket, objectName: t.path, contentType: mime },
      onProgress: (sent, total) => onProgress(total ? Math.round((sent / total) * 100) : 0),
      onError: () => reject(new Error('upload')),
      onSuccess: () => resolve(),
    });
    task.start();
  });
}

/**
 * Shared upload control (P1.5). Consumers (P2.2 cover, P2.4 documents, P2.5 diary) only pass a purpose
 * and project and receive the stored file references; they never edit this component.
 * Flow: begin (server issues one token per file) -> resumable TUS upload -> complete (server validates).
 * The original file is sent exactly as the phone produced it.
 */
export function FileUpload({ purpose, projectId, onUploaded, camera, label = 'בחירת קבצים', disabled }: FileUploadProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const shooter = useRef<HTMLInputElement>(null);
  const limit = MAX_FILES[purpose];

  const patch = (key: string, change: Partial<Item>) => setItems(list => list.map(i => (i.key === key ? { ...i, ...change } : i)));

  function add(files: FileList | null) {
    if (!files) return;
    setNotice(null);
    const next = [...items];
    const counted = () => next.filter(i => i.mime).length;
    for (const file of Array.from(files)) {
      if (counted() >= limit) { setNotice(limit === 1 ? 'אפשר לבחור קובץ אחד בלבד' : `אפשר לבחור עד ${limit} קבצים בכל פעם`); break; }
      const check = checkFile(file, purpose);
      next.push({ key: newId(), file, mime: check.ok ? check.mime : null, status: check.ok ? 'ready' : 'error', progress: 0, error: check.ok ? undefined : check.reason });
    }
    setItems(next);
  }

  async function start() {
    const queue = items.filter(i => (i.status === 'ready' || i.status === 'error') && i.mime);
    if (queue.length === 0) return;
    setBusy(true);
    setNotice(null);
    queue.forEach(i => patch(i.key, { status: 'uploading', progress: 0 }));
    const begun = await post<UploadTarget[]>('/api/storage/uploads', {
      purpose, projectId, files: queue.map(i => ({ clientId: i.key, name: i.file.name, mime: i.mime, sizeBytes: i.file.size })),
    });
    if (!begun.ok) {
      queue.forEach(i => patch(i.key, { status: 'error', error: begun.error.message }));
      setBusy(false);
      return;
    }
    const finished: FileRef[] = [];
    await Promise.all(queue.map(async item => {
      const target = begun.value.find(t => t.clientId === item.key)?.target;
      if (!target || !target.ok) { patch(item.key, { status: 'error', error: target && !target.ok ? target.error.message : 'ההעלאה נכשלה' }); return; }
      try {
        await sendTus(item.file, item.mime!, target.value, progress => patch(item.key, { progress }));
        const done = await post<FileRef>(`/api/storage/uploads/${target.value.fileId}/complete`);
        if (done.ok) { finished.push(done.value); patch(item.key, { status: 'done', progress: 100, ref: done.value }); }
        else patch(item.key, { status: 'error', error: done.error.message });
      } catch {
        patch(item.key, { status: 'error', error: 'ההעלאה נכשלה. אפשר לנסות שוב' });
      }
    }));
    setBusy(false);
    if (finished.length > 0) onUploaded(finished);
  }

  const readyCount = items.filter(i => (i.status === 'ready' || i.status === 'error') && i.mime).length;
  const accept = ACCEPTED_MIME.join(',') + ',.heic,.heif';
  return (
    <div className="upload">
      <div className="upload__actions">
        <Button variant="secondary" disabled={disabled || busy} onClick={() => picker.current?.click()}>{label}</Button>
        {camera && <Button variant="secondary" disabled={disabled || busy} onClick={() => shooter.current?.click()}>צילום</Button>}
        <input ref={picker} className="sr-only" type="file" tabIndex={-1} aria-label={label} accept={accept} multiple={limit > 1}
          onChange={e => { add(e.target.files); e.target.value = ''; }} />
        {camera && <input ref={shooter} className="sr-only" type="file" tabIndex={-1} aria-label="צילום" accept="image/*" capture="environment"
          onChange={e => { add(e.target.files); e.target.value = ''; }} />}
      </div>
      {notice && <Notice>{notice}</Notice>}
      {items.length > 0 && (
        <ul className="upload__list">
          {items.map(item => (
            <li key={item.key} className={`upload__item${item.status === 'error' ? ' upload__item--error' : ''}${item.status === 'done' ? ' upload__item--done' : ''}`}>
              <div className="upload__name">
                <span className="ltr">{item.file.name}</span>
                <div className="upload__meta">
                  {formatSize(item.file.size)} ·{' '}
                  {item.status === 'ready' && 'ממתין להעלאה'}
                  {item.status === 'uploading' && `מעלה ${item.progress}%`}
                  {item.status === 'done' && 'הועלה'}
                  {item.status === 'error' && item.error}
                </div>
                {item.status === 'uploading' && <div className="upload__bar"><span style={{ width: `${item.progress}%` }} /></div>}
              </div>
              {item.status !== 'uploading' && item.status !== 'done' && (
                <Button variant="secondary" size="small" aria-label={`הסרת ${item.file.name}`} onClick={() => setItems(list => list.filter(i => i.key !== item.key))}>הסרה</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {readyCount > 0 && <Button disabled={busy || disabled} onClick={start}>{busy ? 'מעלה…' : readyCount > 1 ? `העלאת ${readyCount} קבצים` : 'העלאה'}</Button>}
    </div>
  );
}
