import { GeneralDiary } from '@/features/diary/shared/GeneralDiary';

export const metadata = { title: 'יומן עבודה' };

/** The general diary: reports of every project the viewer can see, newest first. Filter lives in the URL. */
export default async function DiaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <GeneralDiary query={await searchParams} />;
}
