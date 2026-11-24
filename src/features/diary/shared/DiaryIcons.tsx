/** Same icons as the finance rows (pen, trash, print), drawn in the text colour. Own copy so the two features stay independent. */
const base = { className: 'dr-icon', viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': true, focusable: 'false', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const PencilIcon = () => <svg {...base}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3" /></svg>;
export const TrashIcon = () => <svg {...base}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const PrintIcon = () => <svg {...base} strokeWidth={1.8}><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" /></svg>;
