'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Notice } from '@/components/ui';
import { FileUpload } from '@/components/upload/FileUpload';
import { setProjectCover } from '../logic/actions';
import type { FileRef } from '@/types/contracts';
import { coverSrc, errorText } from './view-model';
import css from './CoverControl.module.css';

/** Owner-only cover image (F03): pick one image through the shared upload, then bind it to the project. */
export function CoverControl({ id, revision, coverFileId, onSaved }: { id: string; revision: number; coverFileId: string | null; /** Called with the new revision once the cover is bound (the wizard keeps its own copy). */ onSaved?: (revision: number) => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState(coverFileId);
  const [rev, setRev] = useState(revision);
  const src = coverSrc(current);

  async function onUploaded(files: FileRef[]) {
    const file = files[0];
    if (!file) return;
    setError(null);
    const result = await setProjectCover({ id, expectedRevision: rev, fileId: file.id });
    if (!result.ok) { setError(errorText(result.error.code, result.error.message)); return; }
    setCurrent(file.id);
    setRev(result.value.revision);
    onSaved?.(result.value.revision);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={css.box}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className={css.img} src={src} alt="תמונת השער של הפרויקט" />
        : <p className={css.empty}>אין תמונת שער</p>}
      <FileUpload purpose="cover" projectId={id} onUploaded={onUploaded} camera label={src ? 'החלפת תמונה' : 'בחירת תמונה'} />
      {saved && <Notice>תמונת השער נשמרה</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
