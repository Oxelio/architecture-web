// @file apps/api/src/features/identity/change-email/change-email.route-options.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { ChangeEmailHttpContract } from "./change-email.http.js";

export const ChangeEmailBodySchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
});

export const changeEmailRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Change email",

    body: ChangeEmailBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(ChangeEmailHttpContract.success),

      ...createErrorResponseSchemas(ChangeEmailHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
