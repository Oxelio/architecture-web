// @file apps/api/src/features/identity/activate-user/activate-user.route-options.ts

import { Type } from "@sinclair/typebox";

import {
  ActivateUserHttpSuccess,
  ActivateUserHttpErrors,
} from "./activate-user.presenter.js";
import type { RouteShorthandOptions } from "fastify";
import { createErrorResponseSchemas } from "../../../helpers/create-error-response-schemas.js";
import { createHttpSuccessResponseSchemas } from "../../../helpers/create-success-response-schemas.js";

export const ActivateUserParamsSchema = Type.Object({
  userId: Type.String({
    format: "uuid",
  }),
});

export const activateUserRouteOptions = {
  schema: {
    tags: ["Identity"],

    summary: "Activate user",

    params: ActivateUserParamsSchema,

    response: {
      ...createHttpSuccessResponseSchemas(ActivateUserHttpSuccess),

      ...createErrorResponseSchemas(ActivateUserHttpErrors),
    },
  },
} satisfies RouteShorthandOptions;
