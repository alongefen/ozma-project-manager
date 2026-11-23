import { GeneralDiary } from '@/features/diary/shared/GeneralDiary';

export const metadata = { title: 'דיווח חדש' };

/** The phone's report button: the diary with the new-report window open over it. */
export default async function NewReportPage() {
  return <GeneralDiary query={{}} startOpen />;
}
