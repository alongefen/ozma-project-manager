'use client';
import { useActionState } from 'react';
import { Button, Notice, TextField } from '@/components/ui';
import { signInAction, type SignInState } from './actions';

/** One form for both views; the phone/desktop frames around it differ (see mobile/ and desktop/). */
export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  return (
    <form action={action} className="signin__form" noValidate>
      <h1>כניסה</h1>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <TextField label="אימייל" name="email" type="email" autoComplete="username" inputMode="email" ltr error={state.fieldErrors?.email} />
      <TextField label="סיסמה" name="password" type="password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <Button type="submit" block disabled={pending}>{pending ? 'נכנסים…' : 'כניסה'}</Button>
      <p className="signin__help">לא זוכרים את הסיסמה? פנו לבן.</p>
    </form>
  );
}
