import sharp from 'sharp';
import { PDFDocument } from '@cantoo/pdf-lib';
import type { ReportInput } from '../../../../src/features/reports/logic/rendering/index';
export const input: ReportInput = {
  projectName: 'פרויקט בדיקה', scope: { kind: 'range', from: '2026-01-01', to: '2026-01-31' },
  entries: [{ id: 'a', workDate: '2026-01-02', reporterName: 'בודק בדוי', createdAt: '2026-01-03T08:00:00Z', text: 'שורה בעברית 123 English' }],
};
export async function attachmentPdf(width = 240, encrypted = false) {
  const doc = await PDFDocument.create();
  doc.addPage([width, 300]).drawText('Synthetic attachment', { x: 20, y: 260, size: 14 });
  if (encrypted) doc.encrypt({ userPassword: 'synthetic-test-only', ownerPassword: 'synthetic-owner-only' });
  return doc.save();
}
export const png = new Uint8Array(await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#268264"/><rect x="30" y="30" width="580" height="300" fill="#eef4ee"/><circle cx="120" cy="180" r="65" fill="#d2ae64"/><text x="220" y="180" font-size="32" fill="#18232d">TEST IMAGE 123</text><path d="M220 220h320" stroke="#18232d" stroke-width="6"/></svg>')).png().toBuffer());
