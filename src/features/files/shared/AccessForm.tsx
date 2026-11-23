'use client';
import { useState } from 'react';
import type { AccessCandidate, DocumentRow } from '@/types/contracts';
import { FormActions, Notice } from '@/components/ui';
import { AccessPicker } from './AccessPicker';
import { accessDraftOf, parseAccess, type AccessDraft } from './model';
import type { DocumentAccess } from '@/types/contracts';

/** Access screen (owner only): change who sees one document. The save is refused again on the server for anyone else. */
export function AccessForm({ doc, candidates, busy, error, onSubmit, onCancel }: {
  doc: DocumentRow; candidates: AccessCandidate[]; busy: boolean; error: string | null;
  onSubmit: (access: DocumentAccess) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AccessDraft>(accessDraftOf(doc.access));
  const [fieldError, setFieldError] = useState<string | null>(null);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseAccess(draft, candidates);
    if (!parsed.ok) { setFieldError(parsed.error); return; }
    setFieldError(null);
    onSubmit(parsed.access);
  }
  return (
    <form className="fl-form" onSubmit={submit} noValidate>
      <p className="fl-access__file ltr">{doc.file.name}</p>
      <AccessPicker draft={draft} candidates={candidates} error={fieldError} disabled={busy} onChange={setDraft} />
      {error && <Notice tone="error">{error}</Notice>}
      <FormActions placement="sheet" submitLabel={busy ? 'שומר…' : 'שמירה'} busy={busy} onCancel={onCancel} />
    </form>
  );
}
