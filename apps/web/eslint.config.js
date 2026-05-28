import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import rootConfig from "../../eslint.config.mjs";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const baseConfig = defineConfig([
  globalIgnores(["dist"]),
  ...rootConfig,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);

export default [...baseConfig, eslintConfigPrettier];
