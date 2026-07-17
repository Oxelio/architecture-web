// @file apps/api/src/features/identity/change-email/change-email.route-options.ts

import { Type } from "@sinclair/typebox";

import {
  ChangeEmailHttpErrors,
  ChangeEmailHttpSuccess,
} from "../../../../src/features/identity/change-email/change-email.presenter.js";
import type { RouteShorthandOptions } from "fastify";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

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
      ...createHttpSuccessResponseSchemas(ChangeEmailHttpSuccess),

      ...createErrorResponseSchemas(ChangeEmailHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
