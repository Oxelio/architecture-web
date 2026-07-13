// @file bounded-contexts/identity/vitest.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    exclude: ["**/dist/**", "**/node_modules/**"],

    coverage: {
      provider: "v8",

      reporter: ["text", "html", "lcov"],

      reportsDirectory: "./coverage",

      include: ["**/application/**/*.ts", "**/domain/**/*.ts"],
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
