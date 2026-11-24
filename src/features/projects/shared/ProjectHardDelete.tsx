'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Notice } from '@/components/ui';
import { HardDeleteDialog } from './HardDelete';
import { canOfferHardDelete } from './hard-delete-model';

/** "מחיקה סופית" for a finished or archived project (A-44). Rendered for owner-level accounts only; the server checks again. */
export function ProjectHardDelete({ id, isOwner, archived, completed }: { id: string; isOwner: boolean; archived: boolean; completed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!canOfferHardDelete(isOwner, 'project', { archived, completed })) return null;
  return (
    <>
      {note && <Notice tone="error">{note}</Notice>}
      <Button variant="secondary" onClick={() => setOpen(true)}>מחיקה סופית</Button>
      {open && <HardDeleteDialog kind="project" id={id} open onClose={() => setOpen(false)} onDone={n => { setOpen(false); if (n) setNote(n); router.replace('/projects'); router.refresh(); }} />}
    </>
  );
}
