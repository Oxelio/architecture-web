// @file apps/api/src/features/identity/sign-out/sign-out.route-options.ts

import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { SignOutHttpContract } from "./sign-out.http.js";

export const signOutRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Sign out",

    response: {
      ...createHttpSuccessResponseSchemas(SignOutHttpContract.success),

      ...createErrorResponseSchemas(SignOutHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
