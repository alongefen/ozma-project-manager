import { notFound, redirect } from 'next/navigation';
import { createPlatform } from '@/lib/auth/platform';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { Notice } from '@/components/ui';
import { loadFinanceScreen } from '@/features/finance/shared/load';
import { parseFilter, type FinanceQuery } from '@/features/finance/shared/query';
import { FinanceMobile } from '@/features/finance/mobile/FinanceMobile';
import { FinanceNavProvider } from '@/features/finance/shared/nav';
import { FinanceDesktop } from '@/features/finance/desktop/FinanceDesktop';
import '@/features/finance/shared/finance.css';

export const metadata = { title: 'כספי פרויקט' };

/**
 * Finance of one project. Visible only to the owner and to managers Ben opened it to; everyone else gets a
 * plain 404 with no numbers (the decision is the database's, via getBook). Both shells render the same book.
 */
export default async function ProjectFinancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<FinanceQuery> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const platform = await createPlatform();
  const context = await platform.auth.getContext();
  if (!context.ok) redirect(SIGN_IN_PATH);
  const filter = parseFilter(query);
  const data = await loadFinanceScreen(platform, context.value, id, filter);
  if (data.kind === 'hidden') notFound();
  if (data.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (data.kind === 'error') return <Notice tone="error">{data.message}</Notice>;
  const props = { book: data.book, filteredRows: data.filteredRows, today: context.value.today };
  return (
    <FinanceNavProvider projectId={id} filter={filter}>
      <FinanceMobile {...props} />
      <FinanceDesktop {...props} />
    </FinanceNavProvider>
  );
}
