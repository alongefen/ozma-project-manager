import 'server-only';
import { leadsAvailability } from './availability-policy';

/**
 * Call before lead data access in every route/action and when deriving navigation.
 * Pass isAdmin from the active server request context, never from client input.
 * This gate does not replace RLS/RPC authorization. Do not cache across requests.
 */
export function isLeadsAvailable(isAdmin: boolean): boolean {
  return leadsAvailability({
    environment: process.env.VERCEL_ENV,
    enabled: process.env.LEADS_PREVIEW_ENABLED,
    isAdmin,
  });
}
