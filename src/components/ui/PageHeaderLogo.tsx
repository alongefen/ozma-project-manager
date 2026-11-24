/**
 * The company logo in the phone header (HEADER-LOGO): the physical left side (the end side in RTL), small, with its
 * aspect ratio kept (the file is 690x334). Phone only: `m-only` hides it from 1024 up, where the sidebar has the logo.
 * Eager and high priority so it does not flash in; not a link.
 */
export function HeaderLogo({ className = '' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- same plain img as the sign-in screens and the sidebar
    <img
      className={`m-only ui-hlogo ${className}`.trim()}
      src="/brand/logo.webp"
      alt="חי עוצמה בבנייה"
      width={62}
      height={30}
      loading="eager"
      decoding="sync"
      fetchPriority="high"
    />
  );
}
