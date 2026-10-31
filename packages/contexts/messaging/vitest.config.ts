import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "#entities": fileURLToPath(
        new URL("./src/domain/entities", import.meta.url),
      ),
      "#value-objects": fileURLToPath(
        new URL("./src/domain/value-objects", import.meta.url),
      ),
      "#application": fileURLToPath(
        new URL("./src/application", import.meta.url),
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
