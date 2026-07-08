import { z } from "zod";
import "dotenv/config";

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
    },
  });
}
