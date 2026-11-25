import type { ProjectCard } from '@/types/contracts';
import { format } from '@/lib/format';

/** `active`: finished projects are hidden (the default); `completed`: the owner switched to the finished ones only (CLIENT-FEEDBACK-A item 4). */
export type StatusFilter = 'all' | 'active' | 'completed';
export const SHOW_FINISHED_LABEL = 'פרויקטים שהסתיימו';

/** Client-side filter over the already loaded cards: name, customer and address, and status. */
export function filterProjects(cards: ProjectCard[], search: string, status: StatusFilter): ProjectCard[] {
  const key = format.searchKey(search);
  return cards.filter(card => {
    if (status !== 'all' && card.status !== status) return false;
    if (!key) return true;
    return [card.name, card.businessName, card.siteAddress].some(text => format.searchKey(text).includes(key));
  });
}
