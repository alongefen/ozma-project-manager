'use client';
import { useId } from 'react';
import type { AccessCandidate } from '@/types/contracts';
import { ACCESS_MODES, toggleUser, type AccessDraft, type AccessMode } from './model';

/** Mandatory access choice: three modes, and for "selected" the active people associated with the project. */
export function AccessPicker({ draft, candidates, error, disabled, onChange }: {
  draft: AccessDraft; candidates: AccessCandidate[]; error?: string | null; disabled?: boolean; onChange: (next: AccessDraft) => void;
}) {
  const name = useId();
  return (
    <fieldset className="fl-access" disabled={disabled}>
      <legend className="ui-field__label">מי רשאי לראות את המסמך</legend>
      {ACCESS_MODES.map(m => (
        <label key={m.mode} className="fl-radio">
          <input type="radio" name={name} checked={draft.mode === m.mode} onChange={() => onChange({ mode: m.mode as AccessMode, userIds: draft.userIds })} />
          <span><strong>{m.label}</strong><span className="fl-radio__hint">{m.hint}</span></span>
        </label>
      ))}
      {draft.mode === 'selected' && (
        candidates.length === 0
          ? <p className="fl-empty">אין אנשים פעילים משויכים לפרויקט. אפשר לבחור אפשרות אחרת.</p>
          : <ul className="fl-people">
              {candidates.map(c => (
                <li key={c.userId}>
                  <label className="fl-check">
                    <input type="checkbox" checked={draft.userIds.includes(c.userId)} onChange={() => onChange({ ...draft, userIds: toggleUser(draft.userIds, c.userId) })} />
                    <span>{c.fullName}</span>
                  </label>
                </li>
              ))}
            </ul>
      )}
      {error && <span className="ui-field__error" role="alert">{error}</span>}
    </fieldset>
  );
}
