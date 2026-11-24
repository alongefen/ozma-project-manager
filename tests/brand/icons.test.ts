import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../src/app/manifest';

const png = (p: string) => {
  const b = readFileSync(p);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe('brand icons', () => {
  it('has the square PNGs at the right sizes', () => {
    const sizes: Record<string, number> = {
      'public/icons/apple-touch-icon.png': 180,
      'public/icons/icon-192.png': 192,
      'public/icons/icon-512.png': 512,
      'public/icons/icon-maskable-512.png': 512,
      'public/icons/favicon-32.png': 32,
      'public/icons/favicon-16.png': 16,
    };
    for (const [p, s] of Object.entries(sizes)) expect(png(p)).toEqual({ w: s, h: s });
  });
  it('has a valid favicon.ico with 16/32/48 entries', () => {
    const b = readFileSync('src/app/favicon.ico');
    expect([b.readUInt16LE(0), b.readUInt16LE(2), b.readUInt16LE(4)]).toEqual([0, 1, 3]);
  });
  it('manifest points at existing icons and keeps the Hebrew identity', () => {
    const m = manifest();
    expect(m.theme_color).toBe('#33abe3');
    expect(m.display).toBe('standalone');
    expect(m.lang).toBe('he');
    expect(m.dir).toBe('rtl');
    for (const i of m.icons ?? []) expect(existsSync(`public${i.src}`)).toBe(true);
    expect(m.icons?.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
