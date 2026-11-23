'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui';
import { screenTitle } from '@/lib/navigation';

/** Phone header: screen title, and the account for non-owners (the owner has it under "עוד"). */
export function MobileHeader({ fullName, showAccount }: { fullName: string; showAccount: boolean }) {
  const pathname = usePathname();
  return (
    <header className="m-header m-only">
      <h1>{screenTitle(pathname)}</h1>
      {showAccount && (
        <Link href="/more" className="m-header__account" aria-label={`החשבון של ${fullName}`}>
          <Avatar name={fullName} />
        </Link>
      )}
    </header>
  );
}
