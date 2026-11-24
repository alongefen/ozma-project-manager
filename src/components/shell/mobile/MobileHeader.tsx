'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui';
import { HeaderLogo } from '@/components/ui/PageHeaderLogo';
import { screenTitle } from '@/lib/navigation';
import { isInnerRoute } from '../inner';

/** Phone header: screen title, and the account for non-owners (the owner has it under "עוד"). */
export function MobileHeader({ fullName, showAccount }: { fullName: string; showAccount: boolean }) {
  const pathname = usePathname();
  if (isInnerRoute(pathname)) return null;
  return (
    <header className="m-header m-only">
      <h1>{screenTitle(pathname)}</h1>
      <div className="m-header__end">
        {showAccount && (
          <Link href="/more" className="m-header__account" aria-label={`החשבון של ${fullName}`}>
            <Avatar name={fullName} />
          </Link>
        )}
        <HeaderLogo />
      </div>
    </header>
  );
}
