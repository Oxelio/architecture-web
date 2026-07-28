// @file apps/api/src/features/iam/get-current-account/get-current-account.route-options.ts

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

      ...createErrorResponseSchemas(GetCurrentAccountHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
