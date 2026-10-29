import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const baseConfig = defineConfig(
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
);

export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "node_modules/**"],
  },

  ...baseConfig,

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
    },
  },
];
