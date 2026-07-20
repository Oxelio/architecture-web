// @file apps/api/src/features/identity/resend-email-verification/resend-email-verification.route-options.ts

import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";
import { ResendEmailVerificationHttpContract } from "./resend-email-verification.http.js";

export const resendEmailVerificationRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Resend email verification",

    response: {
      ...createHttpSuccessResponseSchemas(
        ResendEmailVerificationHttpContract.success,
      ),

      ...createErrorResponseSchemas(ResendEmailVerificationHttpContract.errors),
    },
  },
} satisfies RouteShorthandOptions;
