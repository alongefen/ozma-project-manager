import { notFound, redirect } from 'next/navigation';
import { getContext, getPlatform } from '@/components/shell/request';
import { SIGN_IN_PATH } from '@/lib/navigation';
import { Card, Page, PageHeader, StateMessage } from '@/components/ui';
import { createDiaryApi } from '@/features/diary/logic';
import { loadReportableProjects } from '@/features/diary/shared/load';
import { isUuid } from '@/features/diary/shared/model';
import { EntryForm } from '@/features/diary/shared/EntryForm';
import { format } from '@/lib/format';
import '@/features/diary/shared/diary.css';

export const metadata = { title: 'עריכת דיווח' };

const KIND = { created: 'נוצר', corrected: 'תוקן', moved: 'הועבר', cancelled: 'בוטל' } as const;

/** Edit a report. The server decides who may (`canCorrect`); a stranger or a finished project gets a plain 404 / back link. */
export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [platform, context] = await Promise.all([getPlatform(), getContext()]);
  if (!context.ok) redirect(SIGN_IN_PATH);
  const api = createDiaryApi(platform);
  const [entry, versions] = await Promise.all([api.getEntry(context.value, { id }), api.listVersions(context.value, { id })]);
  if (!entry.ok) {
    if (entry.error.code === 'UNAUTHENTICATED') redirect(SIGN_IN_PATH);
    if (entry.error.code === 'UNAVAILABLE') return <StateMessage tone="error" backHref="/diary" backLabel="חזרה ליומן">הדיווח אינו זמין כרגע. נסו שוב בעוד רגע.</StateMessage>;
    notFound();
  }
  const row = entry.value;
  const back = `/projects/${row.projectId}/diary`;
  if (!row.canCorrect && !row.canMoveOrCancel) return <StateMessage backHref={back} backLabel="חזרה ליומן">אי אפשר לערוך את הדיווח הזה. אפשר לצפות ולהדפיס בלבד.</StateMessage>;
  const owner = context.value.actor.isOwner;
  const projects = owner ? (await loadReportableProjects(platform, context.value)) ?? [] : [];
  return (
    <Page narrow>
      <PageHeader title="עריכת דיווח" backHref={back} backLabel="חזרה ליומן" sub={row.projectName} />
      <EntryForm entry={row} projects={projects} canMove={owner && row.canMoveOrCancel} today={context.value.today} backHref={back} />
      {versions.ok && versions.value.length > 0 && (
        <Card>
          <h2 className="dr-section-title">היסטוריית גרסאות</h2>
          <ul className="dr-versions">
            {versions.value.map(v => <li key={v.version}>גרסה {v.version} · {KIND[v.kind]} · {v.editorName} · {format.dateTime(v.createdAt)}</li>)}
          </ul>
        </Card>
      )}
    </Page>
  );
}
