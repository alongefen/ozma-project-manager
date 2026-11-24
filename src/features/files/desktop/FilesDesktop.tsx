'use client';
import { Button, Card, Notice, Pin } from '@/components/ui';
import { DocList } from '../shared/DocList';
import { DocTools } from '../shared/DocTools';
import { useFiles } from '../shared/FilesProvider';

/** Desktop (from 1024): one pinned row (upload, search, category, archive), the document list beneath it. Access is a centred window. */
export function FilesDesktop() {
  const { canUpload, openUpload } = useFiles();
  return (
    <div className="fl fl-desktop d-only">
      <Pin className="fl-bar">
        {canUpload && <Button onClick={openUpload}>+ העלאת מסמך</Button>}
        <DocTools />
      </Pin>
      {!canUpload && <Notice>אין הרשאה להעלות מסמכים כאן. אפשר לפתוח ולהוריד.</Notice>}
      <Card panel><DocList /></Card>
    </div>
  );
}
