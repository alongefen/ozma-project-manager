'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Icon } from '@/components/ui';
import { activeItem, navHref, type NavItem } from '@/lib/navigation';

/** Desktop sidebar, matching the demo's aside (230 wide, 195 from 1024 to 1100). */
export function DesktopSidebar({ items, fullName, roleLabel }: { items: NavItem[]; fullName: string; roleLabel: string }) {
  const pathname = usePathname();
  const current = activeItem(pathname, items);
  return (
    <aside className="d-aside d-only">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo" src="/brand/logo.webp" alt="חי עוצמה בבנייה" width={156} height={80} />
      <div className="d-brandline">סביבת העבודה שלנו</div>
      <nav className="d-nav" aria-label="ניווט ראשי">
        {items.map(item => (
          <Link
            key={item.key}
            href={navHref(item, pathname)}
            className={item.prominent ? 'd-nav__report' : undefined}
            aria-current={current?.key === item.key ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="d-sidebottom">
        <Avatar name={fullName} />
        <div>
          <strong>{fullName}</strong>
          <small>{roleLabel}</small>
        </div>
      </div>
    </aside>
  );
}
