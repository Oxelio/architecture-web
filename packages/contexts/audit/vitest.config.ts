import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "#events": fileURLToPath(
        new URL("./src/application/events", import.meta.url),
      ),
      "#repositories": fileURLToPath(
        new URL("./src/application/repositories", import.meta.url),
      ),
      "#services": fileURLToPath(
        new URL("./src/application/services", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/*.test.ts", "**/index.ts"],
    },
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
