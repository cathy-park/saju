import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // Multi-month astronomy calculations exceed 5s on the shared Intel host.
    testTimeout: 30000,
    maxWorkers: 2,
    include: ["src/**/*.test.ts"],
  },
});
