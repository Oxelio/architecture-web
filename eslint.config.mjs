import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

const baseConfig = defineConfig(
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
);

export default [
  {
    ignores: ["**/dist/**", "node_modules/**"],
  },

  ...baseConfig,

  // Configuration Node.js pour les scripts .mjs
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  eslintConfigPrettier,

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "simple-import-sort": simpleImportSort,
    },

    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-else-return": "error",

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Avoid relative parent imports. Use a configured path alias instead (e.g. #persistence/* or @architecture/*). This keeps module boundaries explicit, prevents fragile dependencies on file locations, and makes refactoring easier.",
            },
          ],
        },
      ],
    },
  },
];
