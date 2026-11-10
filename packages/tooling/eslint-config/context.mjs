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
  "@architecture/iam-email-verification-sha256",
  "@architecture/*/src/**",
  "**/contexts/**/src/**",
  "**/adapters/**",
  "**/apps/**",
];

const boundedContexts = ["iam", "messaging", "audit", "notifications"];

export function foreignContextImports(...allowedContexts) {
  return boundedContexts
    .filter((context) => !allowedContexts.includes(context))
    .flatMap((context) => [
      `@architecture/${context}`,
      `@architecture/${context}/**`,
      `**/contexts/${context}/**`,
    ]);
}

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

export function forContext(owner) {
  return [
    {
      files: ["src/domain/**/*.ts"],
      ignores: ["**/*.spec.ts"],
      rules: {
        "no-restricted-imports": restriction([
          ...technical,
          ...(owner ? foreignContextImports(owner) : []),
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
        "no-restricted-imports": restriction([
          ...technical,
          ...(owner ? foreignContextImports(owner, "messaging") : []),
        ]),
      },
    },
  ];
}

export default forContext();
