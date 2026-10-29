// @file bounded-contexts/iam/vitest.config.ts

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#application-result": fileURLToPath(
        new URL("./src/application/application-result.ts", import.meta.url),
      ),
      "#domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "#entities": fileURLToPath(
        new URL("./src/domain/entities", import.meta.url),
      ),
      "#value-objects": fileURLToPath(
        new URL("./src/domain/value-objects", import.meta.url),
      ),
      "#ports": fileURLToPath(
        new URL("./src/application/ports", import.meta.url),
      ),
      "#accounts": fileURLToPath(
        new URL("./src/application/accounts", import.meta.url),
      ),
      "#authentication": fileURLToPath(
        new URL("./src/application/authentication", import.meta.url),
      ),
      "#access-administration": fileURLToPath(
        new URL("./src/application/access-administration", import.meta.url),
      ),
      "#test": fileURLToPath(new URL("./test/support", import.meta.url)),
    },
  },
  test: {
    environment: "node",

    exclude: ["**/dist/**", "**/node_modules/**"],

    coverage: {
      provider: "v8",

      reporter: ["text", "html", "lcov"],

      reportsDirectory: "./coverage",

      include: ["src/application/**/*.ts", "src/domain/**/*.ts"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.port.ts",
        "**/*index.ts",
      ],
    },
  },
});
