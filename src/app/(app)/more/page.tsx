import { redirect } from 'next/navigation';
import { createPlatform } from '@/lib/auth/platform';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { MoreMobile } from '@/features/more/mobile/MoreMobile';
import { MoreDesktop } from '@/features/more/desktop/MoreDesktop';

export const metadata = { title: 'עוד' };

export default async function MorePage() {
  const context = await (await createPlatform()).auth.getContext();
  if (!context.ok) redirect(SIGN_IN_PATH);
  const { actor } = context.value;
  return (
    <>
      <MoreMobile actor={actor} />
      <MoreDesktop actor={actor} />
    </>
  );
}
