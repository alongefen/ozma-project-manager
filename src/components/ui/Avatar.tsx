import { initials } from '@/lib/navigation';

export function Avatar({ name }: { name: string }) {
  return <span className="ui-avatar" aria-hidden="true">{initials(name)}</span>;
}
