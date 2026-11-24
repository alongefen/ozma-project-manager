import Link from 'next/link';
import { Card, Icon } from '@/components/ui';
import { moreLinks } from '@/lib/navigation';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { AccountCard } from '@/features/account/shared/AccountCard';
import type { Actor } from '@/types/contracts';

/** Phone "more": account first, owner-only links as a plain list, sign-out at the bottom (UX-19: no tabs). */
export function MoreMobile({ actor }: { actor: Actor }) {
  const links = moreLinks(actor.isOwner);
  return (
    <div className="more m-only">
      <Card>
        <AccountCard actor={actor} />
      </Card>
      {links.length > 0 && (
        <Card>
          <ul className="more__list">
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
      <SignOutButton block />
    </div>
  );
}
