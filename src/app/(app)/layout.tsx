import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import '@/styles/app.css';
import { getContext } from '@/components/shell/request';
import { desktopNav, phoneNav, SIGN_IN_PATH } from '@/lib/navigation';
import { BottomNav } from '@/components/shell/mobile/BottomNav';
import { MobileHeader } from '@/components/shell/mobile/MobileHeader';
import { DesktopSidebar } from '@/components/shell/desktop/DesktopSidebar';
import { DesktopHeader } from '@/components/shell/desktop/DesktopHeader';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { isLeadsAvailable } from '@/features/leads/logic/availability';
import { Notice } from '@/components/ui';

export const metadata: Metadata = { title: { default: 'חי עוצמה בבנייה', template: '%s | חי עוצמה' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#33abe3' };
export const dynamic = 'force-dynamic';

/**
 * Two shells over the same routes. The page content is rendered once; the phone chrome (header and
 * bottom navigation) and the desktop chrome (sidebar and header) are separate components, switched at 1024.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  let context;
  try {
    context = await getContext();
  } catch {
    context = null;
  }
  if (context && !context.ok && context.error.code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
  if (!context || !context.ok) {
    return (
      <main className="app-content">
        <Notice tone="error">המערכת אינה זמינה כרגע. נסו שוב בעוד רגע.</Notice>
      </main>
    );
  }
  const { actor } = context.value;
  const roleLabel = actor.isOwner ? 'מנהל מערכת' : 'משתמש';
  return (
    <>
      <DesktopSidebar items={desktopNav(actor.isOwner, isLeadsAvailable(actor.isOwner))} fullName={actor.fullName} roleLabel={roleLabel} />
      <div className="app-main">
        <DesktopHeader fullName={actor.fullName}>
          <SignOutButton />
        </DesktopHeader>
        <MobileHeader fullName={actor.fullName} showAccount={!actor.isOwner} />
        <main className="app-content">{children}</main>
      </div>
      <BottomNav items={phoneNav(actor.isOwner)} />
    </>
  );
}
