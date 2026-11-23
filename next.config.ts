import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
