import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

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
  eslintConfigPrettier,
  {
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-else-return": "error",

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
