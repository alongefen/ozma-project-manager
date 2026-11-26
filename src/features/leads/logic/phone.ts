/** Compare formatting only; do not reject numbers outside a prescribed national format. */
export function canonicalPhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (/^(?:\+972|00972)0?\d+$/.test(compact)) return compact.replace(/^(?:\+972|00972)0?/, '0');
  return compact;
}
