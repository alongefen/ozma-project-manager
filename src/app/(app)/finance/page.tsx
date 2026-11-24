import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { StateMessage } from '@/components/ui';
import { loadFinanceAll, loadTransfer } from '@/features/overview/shared/load';
import { FINANCE_ERROR } from '@/features/overview/shared/view-model';
import { DesktopTitle } from '@/features/overview/shared/Parts';
import { TransferMobile } from '@/features/overview/mobile/TransferMobile';
import { TransferDesktop } from '@/features/overview/desktop/TransferDesktop';
import { parseFilter, type FinanceQuery } from '@/features/finance/shared/query';
import { PrintView } from '@/features/finance/shared/PrintView';
import { FinanceMobile } from '@/features/finance/mobile/FinanceMobile';
import { FinanceDesktop } from '@/features/finance/desktop/FinanceDesktop';
import { FinanceNavProvider } from '@/features/finance/shared/nav';
import '@/features/finance/shared/finance.css';

export const metadata = { title: 'כספים' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Finance of all projects: the same screen as a project's finance tab (filters, search, print, export, totals)
 * over every movement of every project, with a project column and a project filter. Owner only (P29): anyone
 * else gets a plain 404 and nothing is read. Below it, for the whole period, the monthly tax transfer summary.
 */
export default async function FinancePage({ searchParams }: { searchParams: Promise<FinanceQuery> }) {
  const query = await searchParams;
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const filter = parseFilter(query);
  const rawProject = Array.isArray(query.project) ? query.project[0] : query.project;
  if (rawProject && !UUID.test(rawProject)) notFound();
  const [all, transfer] = await Promise.all([
    loadFinanceAll(platform, context.value, filter, rawProject || undefined),
    filter.period === 'all' && !rawProject && filter.day === undefined && !filter.search ? loadTransfer(platform, context.value) : Promise.resolve(null),
  ]);
  if (all.kind === 'hidden') notFound();
  if (all.kind === 'signed-out') redirect(SIGN_IN_PATH);
  if (all.kind === 'error') return <StateMessage tone="error" backHref="/projects" backLabel="חזרה לפרויקטים">{FINANCE_ERROR}</StateMessage>;
  const { book, filteredRows, projects, projectOf, projectId } = all.data;
  const props = { book, filteredRows, today: context.value.today };
  return (
    <>
      <DesktopTitle title="כספים" />
      <FinanceNavProvider all={{ projects, projectOf, project: projectId }} filter={filter}>
        <FinanceMobile {...props} />
        <FinanceDesktop {...props} />
        <PrintView book={book} filteredRows={filteredRows} />
        {transfer?.kind === 'ok' && transfer.months.length > 0 && (
          <>
            <TransferMobile months={transfer.months} embedded />
            <TransferDesktop months={transfer.months} embedded />
          </>
        )}
      </FinanceNavProvider>
    </>
  );
}
