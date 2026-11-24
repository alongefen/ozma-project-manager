'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { activeItem, navHref, type NavItem } from '@/lib/navigation';

/** Phone bottom navigation. Odd item count, "דיווח חדש" prominent in the middle. No sidebar, no tab bar. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const current = activeItem(pathname, items);
  return (
    <nav className="m-nav m-only" aria-label="ניווט ראשי">
      {items.map(item => (
        <Link
          key={item.key}
          href={navHref(item, pathname)}
          className={`m-nav__item${item.prominent ? ' m-nav__item--report' : ''}`}
          aria-current={current?.key === item.key ? 'page' : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
