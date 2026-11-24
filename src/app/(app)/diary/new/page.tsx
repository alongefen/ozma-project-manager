import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { GeneralDiary } from '@/features/diary/shared/GeneralDiary';
import { projectFromReferrer } from '@/features/diary/shared/model';

export const metadata = { title: 'דיווח חדש' };

/**
 * The menu's report button. From inside a project it goes to that project's diary with the window open and the project
 * chosen; from anywhere else it shows the general diary with the window open.
 */
export default async function NewReportPage() {
  const project = projectFromReferrer((await headers()).get('referer'));
  if (project) redirect(`/projects/${project}/diary?new=1`);
  return <GeneralDiary query={{}} startOpen />;
}
