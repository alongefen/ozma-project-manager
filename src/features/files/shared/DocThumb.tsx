'use client';
import { useEffect, useRef, useState } from 'react';
import type { DocumentRow } from '@/types/contracts';
import { extensionLabel, thumbUrl } from './model';

/**
 * Fixed-size preview of a document, so the list never shifts while it loads.
 * Images: the file's display image (JPEG made at upload), lazy loaded through the same permission-checked route as
 * "open"; a shimmer shows until it arrives and the file-type tile replaces it if it fails.
 * PDF and everything else: a file-type tile with the extension (a first-page render would need a PDF library).
 */
export function DocThumb({ file }: { file: DocumentRow['file'] }) {
  const src = thumbUrl(file);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const img = useRef<HTMLImageElement>(null);
  // The image may finish (or fail) before React hydrates, when no handler is attached yet.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? 'ready' : 'failed');
  }, []);
  const showImage = src !== null && state !== 'failed';
  return (
    <div className={`fl-thumb${showImage && state === 'loading' ? ' ui-skel' : ''}`} aria-hidden="true">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} className="fl-thumb__img" src={src} alt="" loading="lazy" decoding="async" width={72} height={72}
          data-state={state} onLoad={() => setState('ready')} onError={() => setState('failed')} />
      ) : (
        <span className={`fl-thumb__tile${file.mime === 'application/pdf' ? ' is-pdf' : ''}`}>
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M7 3h7l5 5v13H7zM14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          <span className="fl-thumb__ext">{extensionLabel(file)}</span>
        </span>
      )}
    </div>
  );
}
