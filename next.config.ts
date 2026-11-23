import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only (ignored by build and start): let `next dev` be opened through 127.0.0.1 or a LAN address (a phone).
  // Without this Next blocks the dev scripts, the page never hydrates, buttons stay dead and every tab click is a full page load.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*", "172.2*.*.*", "172.30.*.*", "172.31.*.*"],
  // Client router cache: a page visited in the last 30 s opens instantly on back/forward and tab switches.
  // Per browser tab, never shared between users; every server action that writes refreshes it.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  serverExternalPackages: [
    "sharp",
    "heic-convert",
    "libheif-js",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  outputFileTracingIncludes: {
    "/api/reports/diary": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./src/features/reports/assets/**",
    ],
    "/api/storage/uploads/*/complete": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/libheif-js/**/*",
    ],
  },
};

export default nextConfig;
