// @file apps/api/src/features/identity/verify-email/verify-email.route-options.ts

import { Type } from "@sinclair/typebox";

import type { RouteShorthandOptions } from "fastify";
import {
  VerifyEmailHttpSuccess,
  VerifyEmailHttpErrors,
} from "./verify-email.presenter.js";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

export const VerifyEmailQuerySchema = Type.Object({
  token: Type.String({
    minLength: 1,
  }),
});

export const verifyEmailRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Verify email",

    querystring: VerifyEmailQuerySchema,

    response: {
      ...createHttpSuccessResponseSchemas(VerifyEmailHttpSuccess),

      ...createErrorResponseSchemas(VerifyEmailHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
