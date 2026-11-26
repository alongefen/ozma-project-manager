import { isLeadsAvailable } from '@/features/leads/logic/availability';
import { redirect } from 'next/navigation';
import { getContext } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { MoreMobile } from '@/features/more/mobile/MoreMobile';
import { MoreDesktop } from '@/features/more/desktop/MoreDesktop';

export const metadata = { title: 'עוד' };

export default async function MorePage() {
  const context = await getContext();
  if (!context.ok) redirect(SIGN_IN_PATH);
  const { actor } = context.value;
  return (
    <>
      <MoreMobile actor={actor} leadsAvailable={isLeadsAvailable(actor.isOwner)} />
      <MoreDesktop actor={actor} leadsAvailable={isLeadsAvailable(actor.isOwner)} />
    </>
  );
}
