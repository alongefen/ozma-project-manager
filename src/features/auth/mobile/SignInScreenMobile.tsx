/** Phone sign-in header: full-width brand block above the full-screen form. Hidden from 1024 up. */
export function SignInBrandMobile() {
  return (
    <div className="signin__brand m-only">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.webp" alt="חי עוצמה בבנייה" width={156} height={80} />
      <p>סביבת העבודה שלנו</p>
    </div>
  );
}
