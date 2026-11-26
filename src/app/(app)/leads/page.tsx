import { notFound } from 'next/navigation';
import { DesktopTitle, Page } from '@/components/ui';
import { loadLeads } from '@/features/leads/shared/load';
import { LeadsProvider } from '@/features/leads/shared/LeadsProvider';
export const metadata = { title: 'לידים' };
export default async function LeadsPage() {
  const data = await loadLeads();
  if (!data) notFound();
  return <Page><DesktopTitle title="לידים" /><LeadsProvider initial={data.rows} today={data.today} /></Page>;
}
