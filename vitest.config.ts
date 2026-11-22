import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const cloudTests = [
  "tests/db/**/*.test.ts",
  "tests/auth/**/*.test.ts",
  "tests/storage/**/*.test.ts",
  "tests/**/*.cloud.test.ts",
];

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [...cloudTests, "tests/e2e/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "cloud",
          environment: "node",
          include: cloudTests,
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
