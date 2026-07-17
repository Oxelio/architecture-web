// @file apps/api/src/features/identity/resend-email-verification/resend-email-verification.route-options.ts

import type { RouteShorthandOptions } from "fastify";
import {
  ResendEmailVerificationHttpSuccess,
  ResendEmailVerificationHttpErrors,
} from "./resend-email-verification.presenter.js";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

export const resendEmailVerificationRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Resend email verification",

    response: {
      ...createHttpSuccessResponseSchemas(ResendEmailVerificationHttpSuccess),

      ...createErrorResponseSchemas(ResendEmailVerificationHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
