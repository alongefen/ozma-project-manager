import { PageHeader } from './PageHeader';

/** Grey placeholder block for loading.tsx. Same radii as Card so the page does not shift when content arrives. */
export function Skeleton({ height = 16, width, block }: { height?: number; width?: number | string; block?: boolean }) {
  return <span className={`ui-skel${block ? ' ui-skel--block' : ''}`} style={{ height, width }} aria-hidden="true" />;
}

/**
 * Page-shaped loading state. Skeletons stand only where DATA will be (cards, lists, figures); the page chrome is never a skeleton.
 * - `bare`: content only, for routes inside a fixed frame (project tabs) whose header and tabs are already on screen.
 * - `title`: the screen's static desktop title, rendered as the real title (same markup as `DesktopTitle`), not a placeholder.
 * - `bar`: widths of the controls in the screen's action row (search, filters, buttons). Their count and size mirror the real row, so
 *   nothing moves when the data arrives.
 * - `heading`: a static section heading that sits above the data (for example the tab's own title).
 * - `frame`: entering a project, before its name is known: the real header (back link) with placeholders only for the name and the tabs.
 * Never draws a header row of its own: a route's real title comes from the page, `title` or `InnerPageSkeleton`.
 */
export function PageSkeleton({ frame, cards = 2, bare, title, bar, heading }: { frame?: boolean; cards?: number; bare?: boolean; title?: string; bar?: number[]; heading?: string }) {
  return (
    <div className="ui-page" role="status" aria-busy="true">
      <span className="sr-only">טוען…</span>
      {frame && <ProjectFrameHead />}
      {title && <div className="ui-ph d-only"><div className="ui-ph__row"><h1 className="ui-ph__title">{title}</h1></div></div>}
      {heading && <h2 className="ui-skel-heading d-only">{heading}</h2>}
      {bar && <SkeletonBar widths={bar} />}
      {Array.from({ length: cards }, (_, i) => <div key={i} className="ui-card ui-skel-card"><Skeleton height={20} width="40%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /><Skeleton height={14} width="60%" /></div>)}
    </div>
  );
}

/** One row of control-shaped placeholders (44px, the button height) for a screen's action row. */
export function SkeletonBar({ widths }: { widths: number[] }) {
  return <div className="ui-skel-bar d-only">{widths.map((w, i) => <Skeleton key={i} height={44} width={w} />)}</div>;
}

/** Entering a project: the real back link at once; only the name and the tabs, which come from the project, are placeholders. */
function ProjectFrameHead() {
  return (
    <PageHeader title={<Skeleton height={26} width={180} />} backHref="/projects" backLabel="חזרה לרשימת הפרויקטים">
      <Skeleton block height={44} />
    </PageHeader>
  );
}
