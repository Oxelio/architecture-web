// @file apps/api/src/features/identity/sign-out/sign-out.route-options.ts

import type { RouteShorthandOptions } from "fastify";
import { SignOutHttpSuccess, SignOutHttpErrors } from "./sign-out.presenter.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";

export const signOutRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Sign out",

    response: {
      ...createHttpSuccessResponseSchemas(SignOutHttpSuccess),

      ...createErrorResponseSchemas(SignOutHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
