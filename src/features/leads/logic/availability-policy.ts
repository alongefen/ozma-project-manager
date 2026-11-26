/** Feature availability only; RLS and RPC authorization remain independently required. */
export function leadsAvailability({ environment, enabled, isAdmin }: {
  environment: string | undefined;
  enabled: string | undefined;
  isAdmin: boolean;
}): boolean {
  return environment === 'preview' && enabled === 'true' && isAdmin === true;
}
