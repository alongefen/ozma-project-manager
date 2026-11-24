import type { ReportScope } from '@/types/contracts';
import { createReportsApi } from '@/features/reports/logic';
import { createPlatform } from '@/lib/auth/platform';
import { failure } from '@/lib/db/rpc';
import { respond } from '@/lib/storage/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const common = ['kind', 'part', 'download'];
const keysOf = { entry: ['entryId'], day: ['projectId', 'date'], range: ['projectId', 'from', 'to'] } as const;

// Only the shape of the query is checked here; ids, dates and the part number are checked by the service.
function parseQuery(query: URLSearchParams): { scope: unknown; part: number; download: boolean } | null {
  const keys = [...query.keys()];
  if (new Set(keys).size !== keys.length) return null;
  const kind = query.get('kind');
  if (kind !== 'entry' && kind !== 'day' && kind !== 'range') return null;
  const allowed = new Set<string>([...common, ...keysOf[kind]]);
  if (keys.some(key => !allowed.has(key)) || keysOf[kind].some(key => !query.get(key))) return null;
  const part = query.get('part');
  if (part !== null && !(/^[1-9]\d*$/.test(part) && Number.isSafeInteger(Number(part)))) return null;
  const download = query.get('download');
  if (download !== null && download !== '0' && download !== '1') return null;
  const scope: Record<string, string> = { kind };
  for (const key of keysOf[kind]) scope[key] = query.get(key)!;
  return { scope, part: part === null ? 1 : Number(part), download: download === '1' };
}

export async function GET(request: Request) {
  try {
    const platform = await createPlatform();
    const context = await platform.auth.getContext();
    if (!context.ok) return respond(context);
    // A render is expensive; a request another site triggers with the user's cookie is refused.
    if (request.headers.get('sec-fetch-site') === 'cross-site') return respond(failure('FORBIDDEN'));
    const input = parseQuery(new URL(request.url).searchParams);
    if (!input) return respond(failure('VALIDATION'));
    const result = await createReportsApi(platform).renderReportPart(context.value, { scope: input.scope as ReportScope, part: input.part });
    if (!result.ok) return respond(result);
    const { fileName, contentType, stream } = result.value;
    return new Response(stream, { headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${input.download ? 'attachment' : 'inline'}; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    console.error('[reports] route failed:', error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : 'unknown');
    return respond(failure('UNAVAILABLE'));
  }
}
