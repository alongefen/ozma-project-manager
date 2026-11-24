'use client';
import { useEffect, useRef, useState } from 'react';
import type { DocumentRow } from '@/types/contracts';
import { MAX_PDF_PREVIEW_BYTES, pdfThumb } from './pdfThumb';
import { extensionLabel, fileHref, fileKind, thumbUrl } from './model';

/**
 * Fixed-size preview of a document, so the list never shifts while it loads.
 * - Images: the display image made at upload, lazy loaded through the permission-checked route ("open" uses the same).
 * - PDF (up to 12MB): the real first page, drawn in the browser when the row scrolls into view.
 * - Word, Excel, PowerPoint and everything else, or when a preview fails: a file-type tile with the extension.
 * A shimmer shows while a preview loads.
 */
export function DocThumb({ file }: { file: DocumentRow['file'] }) {
  const kind = fileKind(file.mime);
  const imageSrc = thumbUrl(file);
  const wantsPdf = kind === 'pdf' && file.sizeBytes <= MAX_PDF_PREVIEW_BYTES;
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  // The image may finish (or fail) before React hydrates, when no handler is attached yet.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? 'ready' : 'failed');
  }, []);

  useEffect(() => {
    if (!wantsPdf || !box.current) return;
    let alive = true;
    const watcher = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      watcher.disconnect();
      pdfThumb(fileHref(file.id, false)).then(
        data => { if (alive) { setPdfSrc(data); setState('ready'); } },
        () => { if (alive) setState('failed'); },
      );
    }, { rootMargin: '200px' });
    watcher.observe(box.current);
    return () => { alive = false; watcher.disconnect(); };
  }, [wantsPdf, file.id]);

  const src = imageSrc ?? pdfSrc;
  const showPreview = (imageSrc !== null || wantsPdf) && state !== 'failed';
  return (
    <div ref={box} className={`fl-thumb${showPreview && state === 'loading' ? ' ui-skel' : ''}`} aria-hidden="true">
      {showPreview ? (
        src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img} className={`fl-thumb__img${pdfSrc ? ' is-page' : ''}`} src={src} alt="" loading="lazy" decoding="async" width={72} height={72}
            data-state={state} onLoad={() => setState('ready')} onError={() => setState('failed')} />
        )
      ) : (
        <span className={`fl-thumb__tile is-${kind}`}>
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M7 3h7l5 5v13H7zM14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          <span className="fl-thumb__ext">{extensionLabel(file)}</span>
        </span>
      )}
    </div>
  );
}
