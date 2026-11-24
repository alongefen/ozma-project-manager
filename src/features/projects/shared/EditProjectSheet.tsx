'use client';
import { useState } from 'react';
import { Button, EditIcon, IconButton, Sheet } from '@/components/ui';
import { CoverControl } from './CoverControl';
import { ProjectForm } from './ProjectForm';
import type { FormValues } from './form-model';

/** "Edit details" opens the project form in a pop-up: bottom sheet on the phone, centred window on desktop. */
export function EditProjectSheet({ id, revision, coverFileId, isOwner, manage, initial, icon, contactOnly }: {
  id: string; revision: number; coverFileId: string | null; isOwner: boolean; manage: boolean; initial: FormValues; icon?: boolean; /** Edit only the contact person (same form, other parts kept). */ contactOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {icon
        ? <IconButton label={contactOnly ? 'עריכת איש קשר' : 'עריכת פרטים'} onClick={() => setOpen(true)}><EditIcon size={22} /></IconButton>
        : <Button variant="secondary" size="small" onClick={() => setOpen(true)}><EditIcon size={18} />{contactOnly ? 'עריכת איש קשר' : 'עריכת פרטים'}</Button>}
      <Sheet open={open} onClose={() => setOpen(false)} title={contactOnly ? 'עריכת איש קשר' : 'עריכת פרטים'}>
        {manage && !contactOnly && <CoverControl id={id} revision={revision} coverFileId={coverFileId} />}
        <ProjectForm mode="edit" isOwner={isOwner} projectId={id} revision={revision} initial={initial} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} parts={contactOnly ? ['contact'] : undefined} />
      </Sheet>
    </>
  );
}
