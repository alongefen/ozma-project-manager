'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { CoverControl } from './CoverControl';
import { ProjectForm } from './ProjectForm';
import { Sheet } from './Sheet';
import type { FormValues } from './form-model';
import css from './EditProjectSheet.module.css';

/** "Edit details" opens the project form in a pop-up: bottom sheet on the phone, centred window on desktop. */
export function EditProjectSheet({ id, revision, coverFileId, isOwner, manage, initial, icon }: {
  id: string; revision: number; coverFileId: string | null; isOwner: boolean; manage: boolean; initial: FormValues; icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {icon ? (
        <button type="button" className={css.iconBtn} aria-label="עריכת פרטים" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : <Button size="small" onClick={() => setOpen(true)}>עריכת פרטים</Button>}
      <Sheet open={open} onClose={() => setOpen(false)} title="עריכת פרטים">
        {manage && <CoverControl id={id} revision={revision} coverFileId={coverFileId} />}
        <ProjectForm mode="edit" isOwner={isOwner} projectId={id} revision={revision} initial={initial} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
