/** Explicit direction, so RTL never mirrors it: "right" and "left" are physical sides. */
export function Chevron({ side }: { side: 'right' | 'left' }) {
  return (
    <svg className="fin-chevron" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={side === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
