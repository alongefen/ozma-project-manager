import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
