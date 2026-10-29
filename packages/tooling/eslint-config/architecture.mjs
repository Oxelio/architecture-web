export default [
  {
    files: ["**/*.ts", "**/*.tsx"],

    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Avoid relative parent imports. Prefer package import aliases using the # prefix (e.g. #features/*, #config/*, #helpers/*). This keeps module boundaries explicit, prevents fragile dependencies on file locations, and makes refactoring safer.",
            },
          ],
        },
      ],
    },
  },
];
