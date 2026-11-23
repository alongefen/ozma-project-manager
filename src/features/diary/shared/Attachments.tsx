import type { FileRef } from '@/types/contracts';
import { fileUrl, previewUrl } from './model';

/** Photos as small previews (click opens the original), other files as a named chip. */
export function Attachments({ files }: { files: FileRef[] }) {
  if (files.length === 0) return null;
  const photos = files.filter(f => previewUrl(f));
  const others = files.filter(f => !previewUrl(f));
  return (
    <div className="dr-att">
      {photos.length > 0 && (
        <ul className="dr-thumbs">
          {photos.map(f => (
            <li key={f.id}>
              <a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" aria-label={`פתיחת ${f.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl(f)!} alt={f.name} loading="lazy" className="dr-thumb" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="dr-files">
          {others.map(f => (
            <li key={f.id}><a href={fileUrl(f.id)} target="_blank" rel="noopener noreferrer" className="dr-file">📄 <span className="ltr">{f.name}</span></a></li>
          ))}
        </ul>
      )}
    </div>
  );
}
