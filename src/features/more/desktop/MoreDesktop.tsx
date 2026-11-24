import Link from 'next/link';
import { Card, Icon } from '@/components/ui';
import { moreLinks } from '@/lib/navigation';
import { AccountCard } from '@/features/account/shared/AccountCard';
import type { Actor } from '@/types/contracts';

/** Desktop "more" (direct link only): two panels. Sign-out lives in the desktop header. */
export function MoreDesktop({ actor }: { actor: Actor }) {
  const links = moreLinks(actor.isOwner);
  return (
    <div className="more d-only">
      <Card panel>
        <h2>החשבון שלי</h2>
        <AccountCard actor={actor} />
      </Card>
      {links.length > 0 && (
        <Card panel>
          <h2>ניהול</h2>
          <ul className="more__list" style={{ marginTop: 8 }}>
            {links.map(link => (
              <li key={link.key}>
                <Link href={link.href} className="more__link">
                  <Icon name={link.icon} />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
