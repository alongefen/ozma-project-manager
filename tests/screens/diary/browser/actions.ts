import type { DateRange, DiarySummary, Result } from '@/types/contracts';
const ok = <T,>(value: T) => ({ ok: true as const, value });
export async function getSummary(input: DateRange & { projectId?: string }): Promise<Result<DiarySummary>> {
  const response = await fetch('/fixture/summary', { method: 'POST', body: JSON.stringify(input) });
  return response.json();
}
export async function getEntry({ id }: { id: string }) { return ok(window.fixture.entries.find(r => r.id === id)!); }
export async function cancelEntry({ id }: { id: string }) {
  await fetch('/fixture/cancel', { method: 'POST' });
  window.fixture.entries = window.fixture.entries.filter(r => r.id !== id);
  return ok({ id, revision: 2 });
}
export async function listEntries() { return ok({ items: window.fixture.entries, nextCursor: null }); }
export async function listVersions() { return ok([]); }
export async function planReport() { return ok({ entryCount: 0, partCount: 0 }); }
