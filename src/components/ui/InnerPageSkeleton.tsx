'use client';
import { useParams } from 'next/navigation';
import { PageHeader } from './PageHeader';
import { Page } from './Page';
import { Skeleton } from './Skeleton';

/**
 * Loading state of an inner page (edit, permissions, a report page): the real `PageHeader` with its static title and back link
 * renders at once, and only the data below it is a skeleton. `[id]` in `backHref` is replaced with the project id from the URL.
 * `subLoading` shows a small placeholder where the header's subtitle (the project name) will come from the data.
 */
export function InnerPageSkeleton({ title, backHref, backLabel, subLoading, narrow = true, cards = 2 }: {
  title: string; backHref: string; backLabel: string; subLoading?: boolean; narrow?: boolean; cards?: number;
}) {
  const params = useParams<{ id?: string }>();
  const href = backHref.replace('[id]', params?.id ?? '');
  return (
    <Page narrow={narrow}>
      <PageHeader title={title} backHref={href} backLabel={backLabel} />
      <div role="status" aria-busy="true" className="ui-page">
        <span className="sr-only">טוען…</span>
        {subLoading && <Skeleton height={16} width={160} />}
        {Array.from({ length: cards }, (_, i) => <div key={i} className="ui-card ui-skel-card"><Skeleton height={20} width="40%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /></div>)}
      </div>
    </Page>
  );
}
