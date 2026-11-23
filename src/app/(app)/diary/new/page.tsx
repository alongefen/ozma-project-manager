import { redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { Page, PageHeader, StateMessage } from '@/components/ui';
import { loadReportableProjects } from '@/features/diary/shared/load';
import { isUuid } from '@/features/diary/shared/model';
import { EntryForm } from '@/features/diary/shared/EntryForm';
import '@/features/diary/shared/diary.css';

export const metadata = { title: 'דיווח חדש' };

/** New report: the prominent middle button of the phone. Only projects the viewer may report on are offered. */
export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const projects = await loadReportableProjects(platform, context.value);
  const back = isUuid(project) ? `/projects/${project}/diary` : '/diary';
  if (!projects) return <StateMessage tone="error" backHref="/diary" backLabel="חזרה ליומן">לא ניתן לטעון את הפרויקטים כרגע. נסו שוב בעוד רגע.</StateMessage>;
  if (projects.length === 0) return <StateMessage backHref="/diary" backLabel="חזרה ליומן">אין פרויקט פעיל שאפשר לדווח עליו.</StateMessage>;
  return (
    <Page narrow>
      <PageHeader title="דיווח חדש" backHref={back} backLabel="חזרה ליומן" />
      <EntryForm projects={projects} canMove={false} today={context.value.today} initialProjectId={isUuid(project) && projects.some(p => p.id === project) ? project : undefined} backHref={back} />
    </Page>
  );
}
