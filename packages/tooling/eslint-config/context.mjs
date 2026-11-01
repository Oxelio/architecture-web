const technical = [
  "node:*",
  "kysely",
  "kysely/*",
  "pg",
  "ioredis",
  "fastify",
  "react",
  "zod",
  "qrcode",
  "argon2",
  "bcrypt",
  "nodemailer",
  "postmark",
  "@architecture/*-kysely",
  "@architecture/*-redis",
  "@architecture/*-argon2",
  "@architecture/*-bcrypt",
  "@architecture/*-nodemailer",
  "@architecture/*-postmark",
  "@architecture/*-webhook",
  "@architecture/*/src/**",
  "**/adapters/**",
  "**/apps/**",
];
const restriction = (patterns) => [
  "error",
  {
    patterns: [
      {
        group: patterns.map((pattern) =>
          pattern.startsWith("#") ? `\\${pattern}` : pattern,
        ),
        message:
          "Keep context domain and application independent of concrete infrastructure and private package internals.",
      },
    ],
  },
];

export default [
  {
    files: ["src/domain/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": restriction([
        ...technical,
        "@architecture/*/application",
        "#application/**",
        "#repositories/**",
        "#services/**",
        "#policies/**",
        "#use-cases/**",
        "#ports/**",
        "#events/**",
        "**/application/**",
      ]),
    },
  },
  {
    files: ["src/application/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": restriction(technical),
    },
  },
];
