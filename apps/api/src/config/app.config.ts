// @file apps/api/src/config/app.config.ts

import "dotenv/config";

import { z } from "zod";

const BooleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

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

  passwordPolicy: z.object({
    level: z
      .enum(["standard", "elevated", "critical", "custom"])
      .default("elevated"),
    privilegedLevel: z
      .enum(["standard", "elevated", "critical", "custom"])
      .default("critical"),
    minLength: z.coerce.number().int().positive().optional(),
    maxLength: z.coerce.number().int().min(64).default(128),
    minimumStrength: z
      .enum(["too_weak", "weak", "acceptable", "strong", "very_strong"])
      .optional(),
    checkCommonPasswords: BooleanString.default(true),
    checkCompromisedPasswords: BooleanString.default(true),
    checkUserContext: BooleanString.default(true),
    rejectCurrentPassword: BooleanString.default(true),
    requireUppercase: BooleanString.default(false),
    requireLowercase: BooleanString.default(false),
    requireNumber: BooleanString.default(false),
    requireSpecialCharacter: BooleanString.default(false),
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
    passwordPolicy: {
      level: process.env["PASSWORD_POLICY_LEVEL"],
      privilegedLevel: process.env["PASSWORD_PRIVILEGED_POLICY_LEVEL"],
      minLength: process.env["PASSWORD_MIN_LENGTH"],
      maxLength: process.env["PASSWORD_MAX_LENGTH"],
      minimumStrength: process.env["PASSWORD_MINIMUM_STRENGTH"],
      checkCommonPasswords: process.env["PASSWORD_CHECK_COMMON"],
      checkCompromisedPasswords: process.env["PASSWORD_CHECK_COMPROMISED"],
      checkUserContext: process.env["PASSWORD_CHECK_CONTEXT"],
      rejectCurrentPassword: process.env["PASSWORD_REJECT_CURRENT"],
      requireUppercase: process.env["PASSWORD_REQUIRE_UPPERCASE"],
      requireLowercase: process.env["PASSWORD_REQUIRE_LOWERCASE"],
      requireNumber: process.env["PASSWORD_REQUIRE_NUMBER"],
      requireSpecialCharacter: process.env["PASSWORD_REQUIRE_SPECIAL"],
    },
  });
}
