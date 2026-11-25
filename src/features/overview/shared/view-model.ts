import type { HomeData, MoneySummary, Month, ProjectCard, TransferMonth } from '@/types/contracts';
import { monthLabel, percent, shekels } from '@/features/finance/shared/present';

/** Presentation only. Every figure arrives already calculated by the overview and finance logic (no sums here). */

export type CounterItem = { key: string; label: string; value: number; href?: string };
export function counterItems(counters: HomeData['counters']): CounterItem[] {
  return [
    { key: 'active', label: 'פרויקטים פעילים', value: counters.activeProjects },
    { key: 'reports', label: 'דיווחים היום', value: counters.reportsToday },
    // Not-owner counts only tasks assigned to them (A-46); the card opens that project's tasks, filtered to "mine", when they are all in one.
    { key: 'tasks', label: 'משימות פתוחות', value: counters.openTasks, href: counters.myTasksProjectId ? `/projects/${counters.myTasksProjectId}/tasks?mine=1` : undefined },
  ];
}

export type CardBadge = { text: string; tone: 'active' | 'gray' };
export function projectBadges(card: ProjectCard): CardBadge[] {
  const badges: CardBadge[] = [card.status === 'active' ? { text: 'פעיל', tone: 'active' } : { text: 'הסתיים', tone: 'gray' }];
  if (card.reportCount > 0) badges.push({ text: `${card.reportCount} דיווחים`, tone: 'gray' });
  return badges;
}

export type CubeRow = { key: string; label: string; value: string };
export function cubeRows(cube: MoneySummary & { month: Month }): CubeRow[] {
  return [
    { key: 'income', label: 'הכנסות', value: shekels(cube.income) },
    { key: 'expense', label: 'הוצאות', value: shekels(cube.expense) },
    { key: 'tax', label: 'מס להעברה', value: shekels(cube.tax) },
    { key: 'net', label: 'רווח נקי', value: shekels(cube.netProfit) },
    { key: 'percent', label: 'אחוז רווח', value: percent(cube.profitPercentTenths) },
  ];
}
export const cubeTitle = (cube: { month: Month }) => `החודש: ${monthLabel(cube.month)}`;

export type TransferLine = { projectId: string; name: string; income: string; expense: string; tax: string; net: string };
export type TransferView = { key: string; label: string; amount: string; lines: TransferLine[] };
/** Months newest first (the logic returns them oldest first). */
export function transferViews(months: TransferMonth[]): TransferView[] {
  return [...months].reverse().map(m => ({
    key: `${m.month.year}-${m.month.month}`,
    label: monthLabel(m.month),
    amount: shekels(m.transferAmount),
    lines: m.projects.map(p => ({
      projectId: p.projectId, name: p.projectName,
      income: shekels(p.summary.income), expense: shekels(p.summary.expense), tax: shekels(p.summary.tax), net: shekels(p.summary.netProfit),
    })),
  }));
}

export const HOME_ERROR = 'המסך אינו זמין כרגע. נסו שוב בעוד רגע.';
export const FINANCE_ERROR = 'סיכום הכספים אינו זמין כרגע. נסו שוב בעוד רגע.';
export const NO_PROJECTS = 'אין פרויקטים להצגה.';
export const NO_TRANSFERS = 'עדיין אין חודשים עם תנועות כספים.';
