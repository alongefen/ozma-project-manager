/**
 * Inner routes are anything below a top-level section (/projects/x, /diary/new). They render their own
 * PageHeader with a back arrow, so the phone shell header (section title) is not shown on them.
 */
export function isInnerRoute(pathname: string): boolean {
  return pathname.split('?')[0].split('/').filter(Boolean).length >= 2;
}
