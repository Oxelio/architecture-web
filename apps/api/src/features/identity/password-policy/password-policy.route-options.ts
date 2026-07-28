import { type Static, Type } from "@sinclair/typebox";
import type { RouteShorthandOptions } from "fastify";

export interface EvaluatePasswordRoute {
  Body: Static<typeof EvaluatePasswordBodySchema>;
}

const EvaluatePasswordBodySchema = Type.Object({
  password: Type.String({ maxLength: 1024 }),
});

export const getPasswordPolicyRouteOptions = {
  schema: {
    tags: ["Identity"],
    summary: "Get the active public password policy",
  },
} satisfies RouteShorthandOptions;

export const evaluatePasswordRouteOptions = {
  schema: {
    tags: ["Identity"],
    summary: "Evaluate a password against the active policy",
    body: EvaluatePasswordBodySchema,
  },
} satisfies RouteShorthandOptions;
