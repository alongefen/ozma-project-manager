'use server';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/lib/auth/actions';
import { HOME_PATH, SIGN_IN_PATH } from '@/lib/navigation';
import { signInMessage } from './messages';

export type SignInState = { error?: string; fieldErrors?: { email?: string; password?: string } };

/** Email is the username (A-09). One generic failure text, so it never reveals whether an account exists. */
export async function signInAction(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const fieldErrors: NonNullable<SignInState['fieldErrors']> = {};
  if (!email) fieldErrors.email = 'יש להזין אימייל';
  if (!password) fieldErrors.password = 'יש להזין סיסמה';
  if (fieldErrors.email || fieldErrors.password) return { fieldErrors };
  const result = await signIn({ email, password });
  if (!result.ok) return { error: signInMessage(result.error.code) };
  redirect(HOME_PATH);
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect(SIGN_IN_PATH);
}
