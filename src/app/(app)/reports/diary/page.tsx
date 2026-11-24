import { redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { Card, Page, PageHeader, StateMessage } from '@/components/ui';
import { loadVisibleProjects } from '@/features/diary/shared/load';
import { PrintByDate } from '@/features/diary/shared/PrintByDate';
import '@/features/diary/shared/diary.css';

export const metadata = { title: 'הדפסה וייצוא יומן לפי תאריך' };

/** Print or PDF of one project's diary for a chosen date (PDF-07). The PDF itself comes from /api/reports/diary. */
export default async function DiaryReportPage() {
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const projects = await loadVisibleProjects(platform, context.value);
  if (!projects) return <StateMessage tone="error" backHref="/diary" backLabel="חזרה ליומן">הפרויקטים אינם זמינים כרגע. נסו שוב בעוד רגע.</StateMessage>;
  return (
    <Page narrow>
      <PageHeader title="הדפסה וייצוא יומן לפי תאריך" backHref="/diary" backLabel="חזרה ליומן" />
      <Card><PrintByDate projects={projects} today={context.value.today} /></Card>
    </Page>
  );
}
