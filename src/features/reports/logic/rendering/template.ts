import { readFile } from "node:fs/promises";
import { PDFDocument } from "@cantoo/pdf-lib";
import sharp from "sharp";
import { validatePart } from "./plan";
import type { ReportPart, ReportWarning } from "./types";

export interface PreparedReport {
  html: string;
  pdfs: PDFDocument[];
  warnings: ReportWarning[];
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

const isolated = (value: string) => `<bdi dir="auto">${escapeHtml(value)}</bdi>`;
const dateText = (value: string) => value.split("-").reverse().join(".");
const timeText = (value: string) => new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
}).format(new Date(value));

export async function prepareReport(part: ReportPart): Promise<PreparedReport> {
  validatePart(part);
  const [font, logo] = await Promise.all([
    readFile(new URL("../../assets/NotoSansHebrew.ttf", import.meta.url)),
    readFile(new URL("../../assets/logo.webp", import.meta.url)),
  ]);
  const warnings: ReportWarning[] = [];
  const pdfs: PDFDocument[] = [];
  const sections: string[] = [];
  for (const entry of part.entries) {
    const attachments: string[] = [];
    for (const attachment of entry.attachments ?? []) {
      let message: string | undefined;
      if (attachment.mediaType === "application/pdf") {
        try {
          const pdf = await PDFDocument.load(attachment.bytes.slice(), { throwOnInvalidObject: true });
          if (pdf.isEncrypted || pdf.getPageCount() === 0) throw new Error("PDF לא נתמך");
          // Force traversal before promising that the attachment will appear in the report.
          const probe = await PDFDocument.create();
          for (const page of await probe.copyPages(pdf, pdf.getPageIndices())) probe.addPage(page);
          await probe.save();
          pdfs.push(probe);
          attachments.push(`<p class="attachment">מצורף בסוף הדוח: ${isolated(attachment.name)} (${pdf.getPageCount()} עמודים)</p>`);
        } catch {
          message = "קובץ PDF פגום או מוצפן — לא ניתן לצרף את עמודיו";
        }
      } else if (["image/jpeg", "image/png", "image/webp"].includes(attachment.mediaType)) {
        try {
          const source = Buffer.from(attachment.bytes.buffer, attachment.bytes.byteOffset, attachment.bytes.byteLength);
          const options = { limitInputPixels: 40_000_000, failOn: "warning", animated: false } as const;
          const meta = await sharp(source, options).metadata();
          // A plain JPEG is embedded as it is: PNG re-encoding made it several times larger and broke Chrome's ~100MiB limit.
          const asIs = meta.format === "jpeg" && (meta.orientation ?? 1) === 1 && (meta.space === "srgb" || meta.space === "b-w");
          if (asIs) await sharp(source, options).stats(); // decodes every pixel, so a truncated file is refused
          const [type, image] = asIs ? ["jpeg", source] as const : ["png", await sharp(source, options).rotate().png().toBuffer()] as const;
          attachments.push(`<figure><img src="data:image/${type};base64,${image.toString("base64")}" alt="${escapeHtml(attachment.name)}"><figcaption>${isolated(attachment.name)}</figcaption></figure>`);
        } catch {
          message = "התמונה פגומה או לא ניתנת להצגה — לא נכללה בדוח";
        }
      } else {
        message = "הקובץ או התמונה לא הומרו לפורמט תצוגה נתמך — לא נכללו בדוח";
      }
      if (message) {
        warnings.push({ entryId: entry.id, attachmentName: attachment.name, message });
        attachments.push(`<p class="warning">${isolated(attachment.name)}: ${escapeHtml(message)}</p>`);
      }
    }
    sections.push(`<article>
      <h2>תאריך עבודה: ${isolated(dateText(entry.workDate))}</h2>
      <div class="metadata"><p>מדווח: ${isolated(entry.reporterName)}</p>
      <p>מועד הזנה: ${isolated(timeText(entry.createdAt))}</p>
      <p>${entry.editedAt ? `נערך: ${isolated(timeText(entry.editedAt))}` : "לא נערך"}</p></div>
      <div class="report-text" dir="auto">${escapeHtml(entry.text)}</div>
      ${attachments.join("\n")}
    </article>`);
  }
  const scope = part.scope.kind === "range" ? `טווח: ${dateText(part.scope.from)} – ${dateText(part.scope.to)}` :
    part.scope.kind === "day" ? `תאריך: ${dateText(part.scope.date)}` : "דיווח בודד";
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>יומן עבודה — ${escapeHtml(part.projectName)}</title>
    <style>
      @font-face{font-family:ReportHebrew;src:url(data:font/ttf;base64,${font.toString("base64")}) format('truetype');font-weight:100 900;font-style:normal}
      @page{size:A4;margin:16mm 15mm 18mm}
      *{box-sizing:border-box}html{font-family:ReportHebrew,sans-serif;font-size:11pt;line-height:1.65;color:#18232d}
      body{margin:0}header{border-bottom:2px solid #d2ae64;padding-bottom:8mm;margin-bottom:8mm}
      .logo{width:44mm;height:auto;max-height:24mm;object-fit:contain}h1{font-size:22pt;margin:3mm 0}h2{font-size:14pt;margin:0 0 3mm;break-after:avoid}
      p{margin:1mm 0}article{margin-bottom:8mm}article+article{border-top:1px solid #bbb;padding-top:6mm}
      .metadata{break-inside:avoid;break-after:avoid;color:#46515b}.report-text{white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext;orphans:3;widows:3;margin-top:4mm}
      bdi{unicode-bidi:isolate;overflow-wrap:anywhere}figure{margin:5mm 0;break-inside:avoid}figure img{display:block;max-width:100%;max-height:190mm;object-fit:contain;margin:auto}
      figcaption{font-size:9pt;text-align:center;overflow-wrap:anywhere}.warning{border-right:3px solid #9e6915;padding:2mm 3mm;break-inside:avoid;overflow-wrap:anywhere}
      .attachment{break-inside:avoid;overflow-wrap:anywhere}.summary{font-size:10pt}.empty{padding:12mm 0}
    </style></head><body><header><img class="logo" src="data:image/webp;base64,${logo.toString("base64")}" alt="חי עוצמה בבנייה">
    <h1>יומן עבודה</h1><p>פרויקט: ${isolated(part.projectName)}</p>
    <p>${isolated(scope)}</p><p class="summary">ימי עבודה: ${part.workDays} · חלק ${part.number} מתוך ${part.total}</p>
    <p class="summary">מועדי ההזנה והעריכה לפי שעון ישראל</p></header>
    ${sections.length ? sections.join("\n") : '<p class="empty">אין דיווחים לתאריך או לטווח שנבחר.</p>'}
    </body></html>`;
  return { html, pdfs, warnings };
}

/** The one HTML template underlying preview, printing and downloading of the resulting PDF. */
export async function buildReportHtml(part: ReportPart): Promise<string> {
  return (await prepareReport(part)).html;
}
