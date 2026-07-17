// @file apps/api/src/features/identity/change-password/change-password.route-options.ts

import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";
import {
  ChangePasswordHttpSuccess,
  ChangePasswordHttpErrors,
} from "./change-password.presenter.js";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

export const ChangePasswordBodySchema = Type.Object({
  password: Type.String({
    minLength: 8,
  }),
});

export const changePasswordRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Change password",

    body: ChangePasswordBodySchema,

    response: {
      ...createHttpSuccessResponseSchemas(ChangePasswordHttpSuccess),

      ...createErrorResponseSchemas(ChangePasswordHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
