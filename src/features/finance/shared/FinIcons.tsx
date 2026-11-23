export function PencilIcon() {
  return (
    <svg className="fin-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg className="fin-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Excel file with a download arrow (Alon's chosen icon): outline, drawn in the text colour. */
export function ExcelIcon({ size = 28 }: { size?: number }) {
  return (
    <svg className="fin-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h8l4 4v5M6 3v18h6M14 3v4h4" />
      <path d="M8.3 9.5l4.2 5.5M12.5 9.5L8.3 15" strokeWidth="2.2" />
      <path d="M18 14v6M15.5 18.2L18 21l2.5-2.8" />
    </svg>
  );
}
