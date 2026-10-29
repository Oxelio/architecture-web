// @file apps/api/src/features/iam/get-current-account/get-current-account.route-options.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { GetCurrentAccountHttpContract } from "./get-current-account.http.js";

export const getCurrentAccountRouteOptions = {
  schema: {
    tags: ["IAM"],

    summary: "Get current IAM account",

    response: {
      ...createHttpSuccessResponseSchemas(
        GetCurrentAccountHttpContract.success,
      ),
      200: Type.Object({
        data: Type.Object({
          userId: Type.String(),
          loginIdentifiers: Type.Array(
            Type.Object({
              kind: Type.Union([
                Type.Literal("username"),
                Type.Literal("email"),
              ]),
              value: Type.String(),
              verificationStatus: Type.Union([
                Type.Literal("not_required"),
                Type.Literal("pending"),
                Type.Literal("verified"),
              ]),
            }),
          ),
          email: Type.Union([Type.String({ format: "email" }), Type.Null()]),
          isEmailVerified: Type.Boolean(),
          role: Type.Union([Type.Literal("user"), Type.Literal("admin")]),
          createdAt: Type.String({ format: "date-time" }),
          updatedAt: Type.String({ format: "date-time" }),
        }),
      }),

      ...createErrorResponseSchemas(GetCurrentAccountHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
