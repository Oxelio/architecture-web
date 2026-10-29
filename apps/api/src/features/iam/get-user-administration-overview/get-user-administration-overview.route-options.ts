import { Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

import { createErrorResponseSchemas } from "#helpers/create-error-response-schemas";

import { GetUserAdministrationOverviewHttpContract } from "./get-user-administration-overview.http.js";

export const getUserAdministrationOverviewRouteOptions = {
  schema: {
    tags: ["IAM administration"],
    summary: "Get global user administration indicators",
    response: {
      200: Type.Object({
        data: Type.Object({
          total: Type.Integer(),
          active: Type.Integer(),
          suspended: Type.Integer(),
          administrators: Type.Integer(),
        }),
      }),
      ...createErrorResponseSchemas(
        GetUserAdministrationOverviewHttpContract.errors,
      ),
    },
  },
} satisfies RouteShorthandOptions;
