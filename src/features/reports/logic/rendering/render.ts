import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "@cantoo/pdf-lib";
import { existsSync } from "node:fs";
import { prepareReport } from "./template";
import type { RenderOptions, ReportPart, ReportWarning } from "./types";

const LOCAL_BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

/**
 * The packaged Chromium runs only on Linux (Vercel). On a developer machine (macOS, Windows) the report uses the
 * installed Chrome: REPORT_CHROME_PATH, or a standard install location. Returns undefined on Linux.
 */
function localBrowser(): string | undefined {
  if (process.platform === "linux") return undefined;
  const fromEnv = process.env.REPORT_CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return LOCAL_BROWSERS.find(path => existsSync(path));
}

/** No remote documents are loaded. Even accidental remote references in the template are blocked. */
export async function renderHtmlToPdf(html: string, requested: RenderOptions = {}): Promise<Uint8Array> {
  const options = { ...requested, executablePath: requested.executablePath ?? localBrowser() };
  if (!options.executablePath && process.platform !== "linux") {
    throw new Error("Chromium הארוז דורש Linux; בפיתוח יש להתקין Chrome או להגדיר REPORT_CHROME_PATH");
  }
  const browser = await puppeteer.launch({
    executablePath: options.executablePath ?? await chromium.executablePath(),
    args: options.executablePath ? [] : chromium.args,
    headless: options.executablePath ? true : "shell",
    // Chromium speaks CDP here; the vulnerable Zod/BiDi parsing path is not used.
    protocol: "cdp",
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", request => {
      // data: contains only the locally embedded image/font bytes. Never allow file: or HTTP(S).
      void (request.url().startsWith("data:") ? request.continue() : request.abort("blockedbyclient")).catch(() => {
        // A page/browser can close while an intercepted request is pending.
      });
    });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.emulateMediaType("print");
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (!document.fonts.check('12px "ReportHebrew"')) throw new Error("גופן הדוח לא נטען");
      for (const image of Array.from(document.images)) {
        await image.decode();
        if (image.naturalWidth === 0) throw new Error("תמונה בדוח לא נטענה");
      }
    });
    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, waitForFonts: true, timeout: 30_000 });
  } finally {
    await browser.close();
  }
}

export async function renderReportPart(part: ReportPart, options: RenderOptions = {}): Promise<{ bytes: Uint8Array; warnings: ReportWarning[] }> {
  const prepared = await prepareReport(part);
  const body = await renderHtmlToPdf(prepared.html, options);
  if (prepared.pdfs.length === 0) return { bytes: body, warnings: prepared.warnings };
  const output = await PDFDocument.load(body);
  for (const pdf of prepared.pdfs) {
    for (const page of await output.copyPages(pdf, pdf.getPageIndices())) output.addPage(page);
  }
  return { bytes: await output.save(), warnings: prepared.warnings };
}
