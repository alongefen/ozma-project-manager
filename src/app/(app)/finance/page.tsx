import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadTransfer } from '@/features/overview/shared/load';
import { FINANCE_ERROR } from '@/features/overview/shared/view-model';
import { TransferMobile } from '@/features/overview/mobile/TransferMobile';
import { TransferDesktop } from '@/features/overview/desktop/TransferDesktop';

export const metadata = { title: 'כספים' };

/** All-projects transfer summary (P29). Owner only: anyone else gets a plain 404 and no figures are read. */
export default async function FinancePage() {
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const result = await loadTransfer(platform, context.value);
  if (result.kind === 'hidden') notFound();
  if (result.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (result.kind === 'error') return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">{FINANCE_ERROR}</StateMessage>;
  return (
    <>
      <TransferMobile months={result.months} />
      <TransferDesktop months={result.months} />
    </>
  );
}
