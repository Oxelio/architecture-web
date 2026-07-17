// @file apps/api/src/features/identity/get-user-profile/get-user-profile.route-options.ts

import type { RouteShorthandOptions } from "fastify";
import {
  GetUserProfileHttpSuccess,
  GetUserProfileHttpErrors,
} from "./get-user-profile.presenter.js";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

export const getUserProfileRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Get user profile",

    response: {
      ...createHttpSuccessResponseSchemas(GetUserProfileHttpSuccess),

      ...createErrorResponseSchemas(GetUserProfileHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
