import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadDiaryScreen } from '@/features/diary/shared/load';
import { parseFilter } from '@/features/diary/shared/model';
import { DiaryProvider } from '@/features/diary/shared/DiaryProvider';
import { DiaryMobile } from '@/features/diary/mobile/DiaryMobile';
import { DiaryDesktop } from '@/features/diary/desktop/DiaryDesktop';
import '@/features/diary/shared/diary.css';

export const metadata = { title: 'יומן הפרויקט' };

/** Diary of one project, inside the project frame. Only this project's reports; a finished project is view and print only. */
export default async function ProjectDiaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const data = await loadDiaryScreen(platform, context.value, { projectId: id, filter: parseFilter(query), basePath: `/projects/${id}/diary` });
  if (data.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (data.kind === 'hidden') notFound();
  if (data.kind === 'error') return <StateMessage tone="error" backHref={`/projects/${id}`} backLabel="חזרה לתיק הפרויקט">היומן אינו זמין כרגע. נסו שוב בעוד רגע.</StateMessage>;
  return (
    <DiaryProvider screen={data.screen} startOpen={query.new === '1'} closeHref={query.new === '1' ? `/projects/${id}/diary` : undefined}>
      <DiaryMobile screen={data.screen} />
      <DiaryDesktop screen={data.screen} title="יומן" />
    </DiaryProvider>
  );
}
