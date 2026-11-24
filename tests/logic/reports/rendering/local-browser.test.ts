import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { renderHtmlToPdf } from '@/features/reports/logic/rendering/render';

// Regression (PRINT-EXPORT): on macOS/Windows the PDF used to fail with UNAVAILABLE because no browser path was
// passed. Without an explicit path the installed Chrome is now found by itself.
const hasLocalChrome = process.platform === 'linux' || ['/Applications/Google Chrome.app', '/Applications/Chromium.app', '/Applications/Microsoft Edge.app'].some(existsSync);

it.skipIf(!hasLocalChrome)('renders a PDF with no executablePath given', async () => {
  const bytes = await renderHtmlToPdf('<html><body>test</body></html>');
  expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe('%PDF');
}, 60_000);
