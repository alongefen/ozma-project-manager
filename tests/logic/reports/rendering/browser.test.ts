import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock('puppeteer-core', () => ({ default: { launch: mocked.launch } }));
import { renderHtmlToPdf } from '../../../../src/features/reports/logic/rendering/index';

function browserFixture() {
  const page = {
    setDefaultTimeout: vi.fn(), setJavaScriptEnabled: vi.fn(), setRequestInterception: vi.fn(),
    on: vi.fn(), setContent: vi.fn(), emulateMediaType: vi.fn(), evaluate: vi.fn(), pdf: vi.fn().mockResolvedValue(new Uint8Array([1])),
  };
  const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
  mocked.launch.mockResolvedValue(browser);
  return { page, browser };
}

describe('Chromium isolation and cleanup', () => {
  beforeEach(() => vi.clearAllMocks());
  it('blocks HTTP, local file and other requests and allows only embedded data', async () => {
    const { page, browser } = browserFixture();
    await renderHtmlToPdf('<html></html>', { executablePath: '/synthetic/chrome' });
    expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mocked.launch.mock.calls[0][0].protocol).toBe('cdp');
    const callback = page.on.mock.calls.find(call => call[0] === 'request')![1];
    for (const url of ['https://example.invalid/a', 'http://localhost/a', 'file:///etc/passwd', 'ftp://example.invalid/a', 'about:blank']) {
      const request = { url: () => url, abort: vi.fn().mockResolvedValue(undefined), continue: vi.fn().mockResolvedValue(undefined) };
      callback(request);
      expect(request.abort).toHaveBeenCalled();
      expect(request.continue).not.toHaveBeenCalled();
    }
    const local = { url: () => 'data:image/png;base64,a', abort: vi.fn(), continue: vi.fn().mockResolvedValue(undefined) };
    callback(local);
    expect(local.continue).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledOnce();
  });
  it.each(['newPage', 'setContent', 'evaluate', 'pdf'])('closes the browser when %s fails', async stage => {
    const { page, browser } = browserFixture();
    const target = stage === 'newPage' ? browser.newPage : page[stage as 'setContent' | 'evaluate' | 'pdf'];
    target.mockRejectedValue(new Error('synthetic failure'));
    await expect(renderHtmlToPdf('<html></html>', { executablePath: '/synthetic/chrome' })).rejects.toThrow('synthetic failure');
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
