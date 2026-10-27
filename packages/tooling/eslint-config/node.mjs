import globals from "globals";

export default [
  {
    files: ["**/*.mjs", "**/*.cjs", "**/scripts/**", "**/*.config.js"],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-console": "off",
    },
  },
];
