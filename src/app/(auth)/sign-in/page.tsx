import { redirect } from 'next/navigation';
import { createPlatform } from '@/lib/auth/platform';
import { HOME_PATH } from '@/lib/navigation';
import { SignInForm } from '@/features/auth/SignInForm';
import { SignInBrandMobile } from '@/features/auth/mobile/SignInScreenMobile';
import { SignInBrandDesktop } from '@/features/auth/desktop/SignInScreenDesktop';

export const metadata = { title: 'כניסה' };
export const dynamic = 'force-dynamic';

async function isSignedIn(): Promise<boolean> {
  try {
    return (await (await createPlatform()).auth.getContext()).ok;
  } catch {
    return false; // Environment not configured: still show the form, sign-in itself fails closed.
  }
}

export default async function SignInPage() {
  if (await isSignedIn()) redirect(HOME_PATH);
  return (
    <main className="signin">
      <div className="signin__card">
        <SignInBrandMobile />
        <SignInBrandDesktop />
        <SignInForm />
      </div>
    </main>
  );
}
