// Locally generated, clearly fictional files: neutral placeholder pictures, simple PDFs and a small Excel file.
// No stock or real photos. Everything is far below the 25MB / 50MB limits.
import {PDFDocument, StandardFonts, rgb} from '@cantoo/pdf-lib';
import ExcelJS from 'exceljs';
import sharp from 'sharp';

export const MIME = {
  photo: 'image/jpeg', pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const TONES = [['#dfe7ef', '#8fa7bd'], ['#efe6d8', '#bda27f'], ['#e3efe0', '#85a97c'], ['#ece1ee', '#a082a8'], ['#efe0e0', '#b08585'], ['#e0ecef', '#7fa5ad'], ['#eeeadb', '#b0a56f']];

// A building silhouette on a soft background. No text, so no fonts are needed.
export async function makePhoto(tone = 0, {width = 1280, height = 960} = {}) {
  const [bg, fg] = TONES[tone % TONES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1280 960">
<rect width="1280" height="960" fill="${bg}"/><rect y="760" width="1280" height="200" fill="${fg}" opacity="0.45"/>
<rect x="220" y="260" width="360" height="500" fill="${fg}"/><rect x="620" y="400" width="300" height="360" fill="${fg}" opacity="0.8"/>
<g fill="${bg}" opacity="0.9">${[0, 1, 2, 3].flatMap(r => [0, 1, 2].map(c => `<rect x="${250 + c * 110}" y="${290 + r * 110}" width="70" height="70"/>`)).join('')}</g>
<rect x="960" y="560" width="14" height="200" fill="${fg}"/><path d="M968 480 L1100 600 L840 600 Z" fill="${fg}" opacity="0.7"/></svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({quality: 82}).toBuffer());
}

// ASCII text only (the standard PDF fonts have no Hebrew); the Hebrew title lives in the file name.
export async function makePdf(title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText('DEMO DOCUMENT - FICTIONAL', {x: 60, y: 760, size: 20, font, color: rgb(0.15, 0.2, 0.3)});
  page.drawText(String(title).replace(/[^\x20-\x7e]/g, '').trim() || 'Sample', {x: 60, y: 720, size: 14, font});
  page.drawText('All names, numbers and addresses here are invented for a demonstration.', {x: 60, y: 690, size: 11, font});
  page.drawText('Not a real contract, plan or report.', {x: 60, y: 672, size: 11, font});
  return new Uint8Array(await doc.save());
}

export async function makeXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Demo', {views: [{rightToLeft: true}]});
  ws.addRow(['פריט', 'כמות', 'מחיר ליחידה', 'סה"כ']);
  const rows = [['בטון (דמו)', 40, 480], ['ברזל (דמו)', 12, 3100], ['טפסנות (דמו)', 8, 1500]];
  rows.forEach(([n, q, p], i) => ws.addRow([n, q, p, {formula: `B${i + 2}*C${i + 2}`, result: q * p}]));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export async function makeFile(kind, {name, tone} = {}) {
  if (kind === 'photo') return {bytes: await makePhoto(tone), mime: MIME.photo, display: true};
  if (kind === 'pdf') return {bytes: await makePdf(name), mime: MIME.pdf, display: false};
  if (kind === 'xlsx') return {bytes: await makeXlsx(), mime: MIME.xlsx, display: false};
  throw new Error(`Unknown demo file kind: ${kind}`);
}
