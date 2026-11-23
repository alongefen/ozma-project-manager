import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadDiaryScreen } from '@/features/diary/shared/load';
import { parseFilter } from '@/features/diary/shared/model';
import { DiaryMobile } from '@/features/diary/mobile/DiaryMobile';
import { DiaryDesktop } from '@/features/diary/desktop/DiaryDesktop';
import '@/features/diary/shared/diary.css';

export const metadata = { title: 'יומן עבודה' };

/** The general diary: reports of every project the viewer can see, newest first. Filter lives in the URL. */
export default async function DiaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const data = await loadDiaryScreen(platform, context.value, { filter: parseFilter(query), basePath: '/diary' });
  if (data.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (data.kind === 'hidden') notFound();
  if (data.kind === 'error') return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">היומן אינו זמין כרגע. נסו שוב בעוד רגע.</StateMessage>;
  return (
    <>
      <DiaryMobile screen={data.screen} />
      <DiaryDesktop screen={data.screen} title="יומן עבודה" />
    </>
  );
}
