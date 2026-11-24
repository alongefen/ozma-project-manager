import { GeneralDiary } from '@/features/diary/shared/GeneralDiary';

export const metadata = { title: 'דיווח חדש' };

/**
 * The general report flow: the general diary with the window open and no project chosen. Never reads the referrer or any
 * remembered project: inside a project the menu button links straight to that project's diary (see `reportHref`).
 */
export default function NewReportPage() {
  return <GeneralDiary query={{}} startOpen />;
}
