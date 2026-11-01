export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@architecture/*/src/**",
                "**/contexts/**/src/**",
                "**/apps/**",
              ],
              message:
                "Adapters consume public package contracts and must not depend on applications or private context internals.",
            },
          ],
        },
      ],
    },
  },
];
