/** Grey placeholder block for loading.tsx. Same radii as Card so the page does not shift when content arrives. */
export function Skeleton({ height = 16, width, block }: { height?: number; width?: number | string; block?: boolean }) {
  return <span className={`ui-skel${block ? ' ui-skel--block' : ''}`} style={{ height, width }} aria-hidden="true" />;
}

/** Page-shaped loading state: header row, optional tabs row, then card placeholders. */
export function PageSkeleton({ tabs, cards = 2 }: { tabs?: boolean; cards?: number }) {
  return (
    <div className="ui-page" role="status" aria-busy="true">
      <span className="sr-only">טוען…</span>
      <div className="ui-ph__row"><Skeleton height={32} width={44} /><Skeleton height={28} width="50%" /></div>
      {tabs && <Skeleton block height={48} />}
      {Array.from({ length: cards }, (_, i) => <div key={i} className="ui-card ui-skel-card"><Skeleton height={20} width="40%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /><Skeleton height={14} width="60%" /></div>)}
    </div>
  );
}
