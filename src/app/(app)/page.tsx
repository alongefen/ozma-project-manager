import { redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadHome } from '@/features/overview/shared/load';
import { HOME_ERROR } from '@/features/overview/shared/view-model';
import { HomeMobile } from '@/features/overview/mobile/HomeMobile';
import { HomeDesktop } from '@/features/overview/desktop/HomeDesktop';

export const metadata = { title: 'בית' };

/** Home: counters, projects and (owner only) the finance cube. The server decides who gets a cube. */
export default async function HomePage() {
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const home = await loadHome(platform, context.value);
  if (home.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (home.kind === 'error') return <StateMessage tone="error" backHref="/more" backLabel="למסך עוד">{HOME_ERROR}</StateMessage>;
  return (
    <>
      <HomeMobile data={home.data} />
      <HomeDesktop data={home.data} />
    </>
  );
}
