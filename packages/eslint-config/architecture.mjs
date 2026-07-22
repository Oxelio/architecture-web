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
                "Avoid relative parent imports. Use path aliases instead (ex: @domain/*, @application/*, @infrastructure/*). This keeps module boundaries explicit and prevents fragile dependencies.",
            },
          ],
        },
      ],
    },
  },
];
