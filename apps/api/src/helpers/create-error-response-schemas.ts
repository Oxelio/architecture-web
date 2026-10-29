// @file apps/api/src/helpers/create-error-response-schemas.ts

import type { HttpErrorDefinitions } from "#types/http.types";

export function createErrorResponseSchemas<T extends string>(
  mapping: HttpErrorDefinitions<T>,
) {
  const responses: Record<number, object> = {};

  const definitions = Object.values(mapping) as HttpErrorDefinitions<T>[T][];

  for (const error of definitions) {
    if (responses[error.status]) {
      continue;
    }

    responses[error.status] = {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code"],
          properties: {
            code: {
              type: "string",
            },
            message: {
              type: "string",
            },
          },
        },
      },
    };
  }

  return responses;
}
