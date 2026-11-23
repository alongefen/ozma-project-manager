import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadDiaryScreen } from './load';
import { parseFilter } from './model';
import { DiaryProvider } from './DiaryProvider';
import { DiaryMobile } from '../mobile/DiaryMobile';
import { DiaryDesktop } from '../desktop/DiaryDesktop';
import './diary.css';

/** The general diary. `/diary/new` (the phone's report button) renders it with the entry window already open. */
export async function GeneralDiary({ query, startOpen }: { query: Record<string, string | string[] | undefined>; startOpen?: boolean }) {
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const data = await loadDiaryScreen(platform, context.value, { filter: parseFilter(query), basePath: '/diary' });
  if (data.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (data.kind === 'hidden') notFound();
  if (data.kind === 'error') return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">היומן אינו זמין כרגע. נסו שוב בעוד רגע.</StateMessage>;
  return (
    <DiaryProvider screen={data.screen} startOpen={startOpen} closeHref={startOpen ? '/diary' : undefined}>
      <DiaryMobile screen={data.screen} />
      <DiaryDesktop screen={data.screen} title="יומן עבודה" />
    </DiaryProvider>
  );
}
