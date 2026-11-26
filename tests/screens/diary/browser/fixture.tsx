import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DiaryProvider } from '@/features/diary/shared/DiaryProvider';
import { DiaryMobile } from '@/features/diary/mobile/DiaryMobile';
import { DiaryDesktop } from '@/features/diary/desktop/DiaryDesktop';
import type { DiaryScreen } from '@/features/diary/shared/types';
import type { DiaryRow } from '@/types/contracts';
import '@/styles/app.css';
import '@/features/diary/shared/diary.css';
export const P = '11111111-1111-4111-8111-111111111111';
const row = (id: string, workDate: string): DiaryRow => ({ id, projectId: P, projectName: 'פרויקט לדוגמה', workDate, body: `דיווח לדוגמה ${id}`, reporterId: P, reporterName: 'בודק לדוגמה', enteredAt: '2026-11-26T08:00:00Z', editedAt: null, editedByName: null, cancelledAt: null, revision: 1, files: [], canCorrect: true, canMoveOrCancel: true });
export const fixture = {
  entries: [row('first', '2026-11-25'), row('unloaded', '2026-11-25')],
  savedId: 'first', refreshes: 0,
  setScreen: (over: Partial<DiaryScreen>) => { void over; },
};
declare global { interface Window { fixture: typeof fixture } }
window.fixture = fixture;
function App() {
  const [screen, setScreen] = useState<DiaryScreen>({ rows: [fixture.entries[0]], nextCursor: 'next-page', filter: { projectId: P }, projects: null, fixedProjectId: P, workDays: { status: 'ready', count: 1 }, canReport: true, formProjects: [{ id: P, name: 'פרויקט לדוגמה' }], isOwner: true, today: '2026-11-26', basePath: `/projects/${P}/diary` });
  useEffect(() => { fixture.setScreen = over => setScreen(cur => ({ ...cur, ...over })); }, []);
  return <main style={{ padding: 16, maxWidth: 1100, margin: 'auto' }}><DiaryProvider screen={screen}><a href="/diary/new">דיווח חדש בטלפון</a><DiaryMobile screen={screen} /><DiaryDesktop screen={screen} /></DiaryProvider></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
