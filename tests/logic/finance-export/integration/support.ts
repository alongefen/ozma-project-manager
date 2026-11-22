import ExcelJS from 'exceljs';
import { expect } from 'vitest';
import type { ErrorCode } from '@/types/contracts';
import { failure } from '@/lib/db/rpc';

export const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const statuses: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409,
  PROJECT_READ_ONLY: 403, LIMIT: 413, RATE_LIMITED: 429, UNAVAILABLE: 503,
};
type Cells = ExcelJS.CellValue[];

export async function sheetRows(bytes: ArrayBuffer | Uint8Array): Promise<Cells[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const rows: Cells[] = [];
  workbook.getWorksheet('כספים')!.eachRow(row => rows.push([1, 2, 3, 4].map(column => row.getCell(column).value)));
  return rows;
}
/** שורות תווית/ערך שמופיעות מיד אחרי הכותרת. */
export function pairsAfter(rows: Cells[], heading: string, count: number) {
  const start = rows.findIndex(row => row[0] === heading);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  return rows.slice(start + 1, start + 1 + count).map(row => [row[0], row[1]]);
}
export async function expectDownload(response: Response, fileName: string) {
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(contentType);
  expect(response.headers.get('content-disposition')).toBe(`attachment; filename="finance.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  return sheetRows(await response.arrayBuffer());
}
/** גוף מדויק: אין בו מקום לקובץ, שם פרויקט, פרטים, סכום או טקסט פנימי. */
export async function expectDenied(response: Response, code: ErrorCode) {
  expect(response.status).toBe(statuses[code]);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toStrictEqual(failure(code));
}
