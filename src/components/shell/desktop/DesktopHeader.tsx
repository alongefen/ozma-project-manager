'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { screenTitle } from '@/lib/navigation';

/** Desktop header: breadcrumb on the right, account and sign-out on the left (DESIGN S01/S02). */
export function DesktopHeader({ fullName, children }: { fullName: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="d-header d-only">
      <span>סביבת עבודה / {screenTitle(pathname)}</span>
      <div className="d-header__account">
        <span>{fullName}</span>
        {children}
      </div>
    </header>
  );
}
