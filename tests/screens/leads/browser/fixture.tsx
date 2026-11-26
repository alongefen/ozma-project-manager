import { createRoot } from 'react-dom/client';
import { LeadsProvider } from '@/features/leads/shared/LeadsProvider';
import { DesktopTitle } from '@/components/ui';
import { DesktopSidebar } from '@/components/shell/desktop/DesktopSidebar';
import { DesktopHeader } from '@/components/shell/desktop/DesktopHeader';
import { MobileHeader } from '@/components/shell/mobile/MobileHeader';
import { BottomNav } from '@/components/shell/mobile/BottomNav';
import { desktopNav,phoneNav } from '@/lib/navigation';
import { fixture } from './actions';
import 'tailwindcss/preflight.css';
import '@/styles/app.css';
function App(){return <><DesktopSidebar items={desktopNav(true,true)} fullName="בודק בדוי" roleLabel="מנהל מערכת"/><div className="app-main"><DesktopHeader fullName="בודק בדוי">{null}</DesktopHeader><MobileHeader fullName="בודק בדוי" showAccount={false}/><main className="app-content"><DesktopTitle title="לידים"/><LeadsProvider initial={[...fixture.rows]} today="2026-11-26"/></main></div><BottomNav items={phoneNav(true)}/></>;}
createRoot(document.getElementById('root')!).render(<App/>);
