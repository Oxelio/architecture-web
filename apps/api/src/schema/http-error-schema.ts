// @file apps/api/src/schema/http-error-schema.ts

import type {
  HttpError,
  HttpErrorDefinitions,
  HttpSuccessDefinition,
  HttpSuccessDefinitions,
} from "#presentation/http.types";

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

interface ApplicationError<T extends string = string> {
  code: T;
  details?: unknown;
}

export function createHttpErrorMapper<TErrorCode extends string>(
  mapping: HttpErrorDefinitions<TErrorCode>,
) {
  return (error: ApplicationError<string>): HttpError => {
    const definition = mapping[error.code as TErrorCode];

    if (!definition) {
      return {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected error",
          },
        },
      };
    }

    return {
      status: definition.status,
      body: {
        error: {
          code: definition.code,
          ...(definition.message && {
            message: definition.message,
          }),
          ...(error.details !== undefined && {
            details: error.details,
          }),
        },
      },
    };
  };
}

export function createHttpSuccessResponseSchemas<TSuccessCode extends string>(
  definitions: HttpSuccessDefinitions<TSuccessCode>,
) {
  const responses = Object.values(definitions) as HttpSuccessDefinition[];

  return Object.fromEntries(
    responses.map((definition) => [
      definition.status,
      {
        description: definition.description,

        ...(definition.status === 204 && {
          type: "null",
        }),

        ...(definition.schema && {
          content: {
            "application/json": {
              schema: definition.schema,
            },
          },
        }),
      },
    ]),
  );
}
