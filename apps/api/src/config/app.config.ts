// @file apps/api/src/config/app.config.ts

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({
  path: new URL("../../.env", import.meta.url),
  quiet: true,
});

const ConfigSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.coerce.number(),
    name: z.string(),
    user: z.string(),
    password: z.string(),
  }),

  redis: z.object({
    host: z.string(),
    port: z.coerce.number(),
  }),

  smtp: z.object({
    host: z.string(),
    port: z.coerce.number(),
    username: z.string(),
    password: z.string(),
    from: z.string(),
    verifyUrl: z.url(),
    recoveryUrl: z.url(),
    deletionCancellationUrl: z.url(),
  }),

  security: z.object({
    encryptionKey: z.string().min(32),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
  return ConfigSchema.parse({
    database: {
      host: process.env["DATABASE_HOST"],
      port: process.env["DATABASE_PORT"],
      name: process.env["DATABASE_NAME"],
      user: process.env["DATABASE_USER"],
      password: process.env["DATABASE_PASSWORD"],
    },
    redis: {
      host: process.env["REDIS_HOST"],
      port: process.env["REDIS_PORT"],
    },
    smtp: {
      host: process.env["SMTP_HOST"],
      port: process.env["SMTP_PORT"],
      username: process.env["SMTP_USERNAME"],
      password: process.env["SMTP_PASSWORD"],
      from: process.env["SMTP_FROM_ADDRESS"],
      verifyUrl: process.env["SMTP_VERIFY_URL"],
      recoveryUrl: process.env["SMTP_RECOVERY_URL"],
      deletionCancellationUrl: process.env["SMTP_DELETION_CANCELLATION_URL"],
    },
    security: {
      encryptionKey: process.env["SECURITY_ENCRYPTION_KEY"],
    },
  });
}
