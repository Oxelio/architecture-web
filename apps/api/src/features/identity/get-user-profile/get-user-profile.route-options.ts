// @file apps/api/src/features/identity/get-user-profile/get-user-profile.route-options.ts

import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
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
