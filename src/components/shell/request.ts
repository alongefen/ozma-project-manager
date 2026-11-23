import 'server-only';
import { cache } from 'react';
import { createPlatform } from '@/lib/auth/platform';

/**
 * Per-request memo (React `cache`): the layout and the page of one request share a single platform and one
 * auth lookup instead of each making their own round trip. The memo lives for one render of one request,
 * so it can never serve one user's identity to another. Do not replace it with a cross-request cache.
 */
export const getPlatform = cache(() => createPlatform());
export const getContext = cache(async () => (await getPlatform()).auth.getContext());
