'use client';
import { useId, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Emails, phones and similar stay left-to-right inside the RTL page. */
  ltr?: boolean;
};

export function TextField({ label, error, hint, ltr, type = 'text', className = '', ...rest }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={id}>{label}</label>
      <div className={`ui-field__control${isPassword ? ' ui-field__control--toggle' : ''}`}>
        <input
          {...rest}
          id={id}
          type={isPassword && shown ? 'text' : type}
          dir={ltr || isPassword ? 'ltr' : undefined}
          className={`ui-field__input ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {isPassword && (
          <button type="button" className="ui-field__toggle" aria-pressed={shown} onClick={() => setShown(v => !v)}>
            {shown ? 'הסתרה' : 'הצגה'}
          </button>
        )}
      </div>
      {hint && <span id={`${id}-hint`} className="ui-field__hint">{hint}</span>}
      {error && <span id={`${id}-err`} className="ui-field__error">{error}</span>}
    </div>
  );
}
