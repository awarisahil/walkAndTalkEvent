import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 60000,
    // All test files share one database, so they must run one at a time
    // (each file truncates the shared tables in its setup hook).
    fileParallelism: false,
  },
});
