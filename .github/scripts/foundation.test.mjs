import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PUPPETEER_REVISIONS } from "puppeteer-core";

const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));

test("Chromium and Puppeteer use the same browser major and exact versions", () => {
  const chromiumVersion = packageJson.dependencies["@sparticuz/chromium"];
  const puppeteerVersion = packageJson.dependencies["puppeteer-core"];
  assert.match(chromiumVersion, /^\d+\.\d+\.\d+$/);
  assert.match(puppeteerVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(chromiumVersion.split(".")[0], PUPPETEER_REVISIONS.chrome.split(".")[0]);
});

test("Linux Chromium starts and communicates with Puppeteer", {
  skip: process.platform !== "linux" ? "חבילת Chromium מיועדת ל-Linux; נבדקת ב-CI" : false,
  timeout: 60_000,
}, async () => {
  const { default: chromium } = await import("@sparticuz/chromium");
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
  try {
    const version = await browser.version();
    assert.match(version, new RegExp(`/${packageJson.dependencies["@sparticuz/chromium"].split(".")[0]}\\.`));
    const page = await browser.newPage();
    assert.equal(await page.evaluate(() => 2 + 3), 5);
  } finally {
    await browser.close();
  }
});
