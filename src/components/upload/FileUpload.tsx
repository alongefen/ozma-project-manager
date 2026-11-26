'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload } from 'tus-js-client';
import { Button, Notice } from '@/components/ui';
import type { FilePurpose, FileRef, Result, UploadTarget } from '@/types/contracts';
import { MAX_FILES, acceptFor, checkFile, declaredMime, formatSize, messageForStatus, resolveMime, sniffMime } from './rules';
import css from './UploadToast.module.css';
import { isDngInput, prepareDng } from './dng/prepare';

type Status = 'preparing' | 'uploading' | 'done' | 'error';
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
  /** True while any file is still uploading; forms use it to block submit and cancel-by-accident. */
  onBusyChange?: (busy: boolean) => void;
};

const newId = () => crypto.randomUUID();

async function post<T>(url: string, body?: unknown): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch (error) {
    console.warn('[upload] request failed (network)', url.replace(/[0-9a-f-]{36}/g, ':id'), error);
    return { ok: false, error: { code: 'UNAVAILABLE', message: 'אין חיבור. נסו שוב' } };
  }
  try {
    return (await response.json()) as Result<T>;
  } catch {
    // The server answered with something that is not our JSON (platform timeout page, 413, 5xx): say so instead of "no connection".
    console.warn('[upload] non-JSON response', response.status, url.replace(/[0-9a-f-]{36}/g, ':id'));
    return { ok: false, error: { code: 'UNAVAILABLE', message: messageForStatus(response.status) } };
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
      onError: error => {
        const status = (error as { originalResponse?: { getStatus(): number } }).originalResponse?.getStatus();
        console.warn('[upload] tus failed', { status, name: error.name, message: error.message, size: file.size, mime });
        reject(Object.assign(new Error('upload'), { status }));
      },
      onSuccess: () => resolve(),
    });
    task.start();
  });
}

/**
 * Shared upload control (P1.5). Consumers (P2.2 cover, P2.4 documents, P2.5 diary) only pass a purpose
 * and project and receive the stored file references; they never edit this component.
 * Upload starts as soon as a file is picked. Flow: begin (server issues one token per file) -> resumable TUS upload -> complete (server validates).
 * DNG is converted locally to JPEG; other original files are sent unchanged.
 */
export function FileUpload({ purpose, projectId, onUploaded, camera, label = 'בחירת קבצים', disabled, onBusyChange }: FileUploadProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ id: string; count: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const picker = useRef<HTMLInputElement>(null);
  const shooter = useRef<HTMLInputElement>(null);
  const limit = MAX_FILES[purpose];
  // Always call the latest callback: the form may have changed while the upload was running.
  const latest = useRef(onUploaded);
  useEffect(() => { latest.current = onUploaded; });

  const preparations = useRef(new Map<string, AbortController>());
  const selecting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const active = preparations.current;
    return () => { mounted.current = false; active.forEach(c => c.abort()); active.clear(); };
  }, []);
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => { itemsRef.current = items; });
  const patch = (key: string, change: Partial<Item>) => setItems(list => list.map(i => (i.key === key ? { ...i, ...change } : i)));

  /** Reads the first bytes so the declared type matches the real content. An unreadable file (cloud-only, removed) fails here with a clear message. */
  async function inspect(file: File): Promise<{ mime: string | null; unreadable: boolean }> {
    const resolved = resolveMime(file);
    try {
      const head = new Uint8Array(await file.slice(0, 128).arrayBuffer());
      return { mime: declaredMime(resolved, sniffMime(head), purpose), unreadable: false };
    } catch (error) {
      console.warn('[upload] cannot read picked file', { name: file.name, size: file.size, type: file.type }, error);
      return { mime: resolved, unreadable: true };
    }
  }

  async function add(picked: File[]) {
    if (picked.length === 0 || selecting.current) return;
    selecting.current = true;
    setNotice(null);
    const available = Math.max(0, limit - itemsRef.current.filter(i => i.mime || i.status === 'preparing').length);
    if (picked.length > available) setNotice(limit === 1 ? 'אפשר לבחור קובץ אחד בלבד' : `אפשר לבחור עד ${limit} קבצים בכל פעם`);
    const added: Item[] = picked.slice(0, available).map(file => ({ key: newId(), file, mime: null, status: 'preparing', progress: 0 }));
    for (const item of added) preparations.current.set(item.key, new AbortController());
    setItems(list => [...list, ...added]);
    const fresh: Item[] = [];
    try {
      // A single decoder at a time bounds memory, including when selecting multiple RAW photos.
      for (const item of added) {
        const controller = preparations.current.get(item.key);
        if (!controller || controller.signal.aborted) continue;
        try {
          const file = isDngInput(item.file) ? await prepareDng(item.file, controller.signal) : item.file;
          if (!mounted.current || controller.signal.aborted) continue;
          const { mime: sniffed, unreadable } = await inspect(file);
          if (!mounted.current || controller.signal.aborted) continue;
          const base = checkFile({ name: file.name, type: sniffed ?? file.type, size: file.size }, purpose);
          const check = unreadable ? { ok: false as const, reason: 'לא ניתן לקרוא את הקובץ. אם הוא בענן (Google Photos / iCloud), יש להוריד אותו קודם למכשיר' } : base;
          const ready: Item = { ...item, file, mime: check.ok ? check.mime : null, status: check.ok ? 'uploading' : 'error', error: check.ok ? undefined : check.reason };
          patch(item.key, ready);
          if (check.ok) fresh.push(ready);
        } catch (error) {
          if (mounted.current && !controller.signal.aborted) patch(item.key, { status: 'error', error: error instanceof Error ? error.message : 'לא ניתן להכין את התמונה. יש לבחור JPEG' });
        } finally { preparations.current.delete(item.key); }
      }
      // Upload starts automatically, using only prepared bytes, never a RAW fallback.
      if (mounted.current && fresh.length > 0) void run(fresh);
    } finally { selecting.current = false; }
  }

  /** Uploads the given items. The client id only matches results to items; a retry after a failure leaves the earlier pending server row unused (never attached, never completed). */
  async function run(queue: Item[]) {
    queue.forEach(i => patch(i.key, { status: 'uploading', progress: 0, error: undefined }));
    const begun = await post<UploadTarget[]>('/api/storage/uploads', {
      purpose, projectId, files: queue.map(i => ({ clientId: i.key, name: i.file.name, mime: i.mime, sizeBytes: i.file.size })),
    });
    if (!begun.ok) {
      queue.forEach(i => patch(i.key, { status: 'error', error: begun.error.message }));
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
        else patch(item.key, { status: 'error', error: done.error.code === 'VALIDATION' ? 'הקובץ לא עבר בדיקה (פגום או לא תואם לסוג שלו). אפשר לנסות קובץ אחר' : done.error.message });
      } catch {
        patch(item.key, { status: 'error', error: 'ההעלאה נכשלה. אפשר לנסות שוב' });
      }
    }));
    if (finished.length > 0) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ id: newId(), count: finished.length });
      toastTimer.current = setTimeout(() => setToast(null), 2500);
      latest.current(finished);
    }
  }

  const busy = items.some(i => i.status === 'uploading' || i.status === 'preparing');
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const accept = acceptFor(purpose);
  // Accepted files live in the consumer's attachment list. Keep accounting here,
  // but do not leave a second success card after the consumer removes a file.
  const visibleItems = items.filter(i => i.status !== 'done');
  return (
    <div className="upload" ref={setRoot}>
      <div className="upload__actions">
        <Button variant="secondary" disabled={disabled || busy} onClick={() => picker.current?.click()}>{label}</Button>
        {camera && <Button variant="secondary" disabled={disabled || busy} onClick={() => shooter.current?.click()}>צילום</Button>}
        <input ref={picker} className="sr-only" type="file" tabIndex={-1} aria-label={label} accept={accept} multiple={limit > 1}
          onChange={e => { const picked = Array.from(e.target.files ?? []); e.target.value = ''; void add(picked); }} />
        {camera && <input ref={shooter} className="sr-only" type="file" tabIndex={-1} aria-label="צילום" accept="image/*" capture="environment"
          onChange={e => { const picked = Array.from(e.target.files ?? []); e.target.value = ''; void add(picked); }} />}
      </div>
      {notice && <Notice>{notice}</Notice>}
      {toast && createPortal(
        <div className={css.host} role="status" aria-live="polite" aria-atomic="true">
          <div key={toast.id} className={css.message}>{toast.count === 1 ? 'הקובץ הועלה' : `${toast.count} קבצים הועלו`}</div>
        </div>,
        // Stay in a modal's top layer, outside its animated/scrolling panel.
        root?.closest('dialog') ?? document.body,
      )}
      {visibleItems.length > 0 && (
        <ul className="upload__list">
          {visibleItems.map(item => (
            <li key={item.key} className={`upload__item${item.status === 'error' ? ' upload__item--error' : ''}`}>
              <div className="upload__name">
                <span className="ltr">{item.file.name}</span>
                <div className="upload__meta">
                  {formatSize(item.file.size)} ·{' '}
                  {item.status === 'preparing' && 'מכין תמונה להעלאה…'}
                  {item.status === 'uploading' && `מעלה ${item.progress}%`}
                  {item.status === 'error' && item.error}
                </div>
                {item.status === 'uploading' && <div className="upload__bar"><span style={{ width: `${item.progress}%` }} /></div>}
              </div>
              {item.status === 'error' && item.mime && (
                <Button variant="secondary" size="small" aria-label={`ניסיון חוזר ל${item.file.name}`} onClick={() => void run([item])}>ניסיון חוזר</Button>
              )}
              {item.status === 'preparing' && (
                <Button variant="secondary" size="small" aria-label={`ביטול הכנת ${item.file.name}`} onClick={() => { preparations.current.get(item.key)?.abort(); setItems(list => list.filter(i => i.key !== item.key)); }}>ביטול</Button>
              )}
              {item.status === 'error' && (
                <Button variant="secondary" size="small" aria-label={`הסרת ${item.file.name}`} onClick={() => setItems(list => list.filter(i => i.key !== item.key))}>הסרה</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
