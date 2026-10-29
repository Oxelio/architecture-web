export default [
  {
    files: ["src/**/*.ts"],
    ignores: [
      "src/composition-root/**",
      "src/adapters/**",
      "src/scripts/**",
      "**/*.spec.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@architecture/iam/domain",
                "@architecture/*/src/**",
                "@architecture/*-kysely",
                "@architecture/*-redis",
                "@architecture/*-argon2",
                "@architecture/*-bcrypt",
                "@architecture/*-nodemailer",
                "@architecture/*-postmark",
                "\\#adapters/**",
                "kysely",
                "kysely/*",
                "pg",
                "ioredis",
                "argon2",
                "bcrypt",
                "nodemailer",
                "postmark",
                "qrcode",
              ],
              message:
                "Transport consumes application contracts; concrete adapters belong to infrastructure and composition.",
            },
          ],
        },
      ],
    },
  },
];
