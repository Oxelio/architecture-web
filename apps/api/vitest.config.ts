import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@architecture/audit-persistence-kysely": fileURLToPath(
        new URL(
          "../../packages/adapters/audit/persistence-kysely/src/index.ts",
          import.meta.url,
        ),
      ),
      "@architecture/notifications-persistence-kysely": fileURLToPath(
        new URL(
          "../../packages/adapters/notifications/persistence-kysely/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    environment: "node",
    exclude: ["**/dist/**", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      allowExternal: true,
      include: [
        "src/**/*.ts",
        "../../packages/adapters/audit/persistence-kysely/src/**/*.ts",
        "../../packages/adapters/notifications/persistence-kysely/src/**/*.ts",
      ],
      exclude: [
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/index.ts",
        "../../packages/adapters/**/persistence-kysely/src/schema.ts",
      ],
    },
  },
});
