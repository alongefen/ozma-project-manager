'use client';
import { Button, Notice, Pin } from '@/components/ui';
import { DocList } from '../shared/DocList';
import { DocTools } from '../shared/DocTools';
import { useFiles } from '../shared/FilesProvider';

/** Phone: pinned upload button, then the filter row (search, category, archive) and the document list. No tab bar. */
export function FilesMobile() {
  const { canUpload, openUpload } = useFiles();
  return (
    <div className="fl fl-mobile m-only">
      {canUpload ? <Pin><Button block icon="add" onClick={openUpload}>העלאת מסמך</Button></Pin> : <Notice>אין הרשאה להעלות מסמכים כאן. אפשר לפתוח ולהוריד.</Notice>}
      <DocTools />
      <DocList />
    </div>
  );
}
