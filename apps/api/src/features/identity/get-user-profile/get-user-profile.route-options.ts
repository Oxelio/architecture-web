// @file apps/api/src/features/identity/get-user-profile/get-user-profile.route-options.ts

import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";
import { createHttpSuccessResponseSchemas } from "#helpers/create-success-response-schemas";

import { GetUserProfileHttpContract } from "./get-user-profile.http.js";

export const getUserProfileRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Get user profile",

    response: {
      ...createHttpSuccessResponseSchemas(GetUserProfileHttpContract.success),

      ...createErrorResponseSchemas(GetUserProfileHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
