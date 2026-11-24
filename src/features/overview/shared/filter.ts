import type { ProjectCard } from '@/types/contracts';
import { format } from '@/lib/format';

export type StatusFilter = 'all' | 'active' | 'completed';
export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'active', label: 'פעילים' },
  { value: 'completed', label: 'הסתיימו' },
];

/** Client-side filter over the already loaded cards: name, customer and address, and status. */
export function filterProjects(cards: ProjectCard[], search: string, status: StatusFilter): ProjectCard[] {
  const key = format.searchKey(search);
  return cards.filter(card => {
    if (status !== 'all' && card.status !== status) return false;
    if (!key) return true;
    return [card.name, card.businessName, card.siteAddress].some(text => format.searchKey(text).includes(key));
  });
}
