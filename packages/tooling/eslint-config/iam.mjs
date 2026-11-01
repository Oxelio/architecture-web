const technical = [
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
  "node:*",
  "@architecture/*-kysely",
  "@architecture/*-redis",
  "@architecture/*-argon2",
  "@architecture/*-bcrypt",
  "@architecture/*-nodemailer",
  "@architecture/*-postmark",
];
const restricted = (patterns) => [
  "error",
  {
    patterns: [
      {
        group: patterns.map((pattern) =>
          pattern.startsWith("#") ? `\\${pattern}` : pattern,
        ),
        message:
          "Respect IAM's inward dependency direction and public application contracts.",
      },
    ],
  },
];
export default [
  {
    files: ["src/domain/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": restricted([
        ...technical,
        "#accounts/**",
        "#authentication/**",
        "#access-administration/**",
        "#repositories/**",
        "#ports/**",
        "#events/**",
        "#test/**",
        "#transactions/**",
        "#testing/**",
        "#application-result",
        "**/application/**",
        "@architecture/iam/application",
        "@architecture/iam/src/**",
      ]),
    },
  },
  {
    files: ["src/application/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-imports": restricted([
        ...technical,
        "@architecture/*/src/**",
        "**/adapters/**",
        "**/apps/**",
      ]),
    },
  },
];
