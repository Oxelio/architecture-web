import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/dist/**", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["**/*.mjs"],
      exclude: ["**/*.spec.mjs", "**/*.test.mjs", "**/vitest.config.ts"],
    },
  },
});
