/**
 * The one icon per action (UI_CONVENTIONS "One language"). Outline, drawn in the current text colour, decorative:
 * the button that holds an icon carries the accessible name. Never draw a second copy in a feature.
 */
import type { ReactNode } from 'react';

type Props = { size?: number };

function Svg({ size = 20, children, width = 1.9 }: Props & { children: ReactNode; width?: number }) {
  return (
    <svg className="ui-aicon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Edit: the pen. */
export const EditIcon = (p: Props) => <Svg {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3" /></Svg>;
/** Delete, cancel an entry, remove: the bin. Always paired with a confirm. */
export const DeleteIcon = (p: Props) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
/** Print: the printer. */
export const PrintIcon = (p: Props) => <Svg {...p} width={1.8}><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" /></Svg>;
/** Export (download a file): the arrow into a tray. */
export const ExportIcon = (p: Props) => <Svg {...p} width={1.8}><path d="M12 3v12m0 0-4-4m4 4 4-4M5 20h14" /></Svg>;
/** Export to Excel (Alon's chosen glyph): the same action as `ExportIcon`, for a spreadsheet. */
export const ExcelIcon = ({ size = 24 }: Props) => (
  <Svg size={size} width={1.8}>
    <path d="M6 3h8l4 4v5M6 3v18h6M14 3v4h4" />
    <path d="M8.3 9.5l4.2 5.5M12.5 9.5L8.3 15" strokeWidth="2.2" />
    <path d="M18 14v6M15.5 18.2L18 21l2.5-2.8" />
  </Svg>
);
/** Add / create: the plus. */
export const AddIcon = (p: Props) => <Svg {...p} width={2.2}><path d="M12 5v14M5 12h14" /></Svg>;
/** Filter: the funnel. */
export const FilterIcon = (p: Props) => <Svg {...p}><path d="M4 5h16l-6 7v6l-4 2v-8z" /></Svg>;
/** Link to an outside file. */
export const LinkIcon = ({ size = 24 }: Props) => <Svg size={size} width={1.8}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
