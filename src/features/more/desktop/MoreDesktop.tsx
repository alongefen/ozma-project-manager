import Link from 'next/link';
import { Avatar, Card, Icon } from '@/components/ui';
import { moreLinks } from '@/lib/navigation';
import type { Actor } from '@/types/contracts';

/** Desktop "more" (direct link only): two panels. Sign-out lives in the desktop header. */
export function MoreDesktop({ actor }: { actor: Actor }) {
  const links = moreLinks(actor.isOwner);
  return (
    <div className="more d-only">
      <Card panel>
        <h2>החשבון שלי</h2>
        <div className="more__account" style={{ marginTop: 16 }}>
          <Avatar name={actor.fullName} />
          <div>
            <strong>{actor.fullName}</strong>
            <span className="more__sub ltr">{actor.email}</span>
          </div>
        </div>
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
