/** Desktop sign-in header: logo inside the white card (card chrome is `.signin__card`, from 1024). */
export function SignInBrandDesktop() {
  return (
    <div className="signin__brand d-only">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.webp" alt="חי עוצמה בבנייה" width={156} height={80} />
      <p>סביבת העבודה שלנו</p>
    </div>
  );
}
