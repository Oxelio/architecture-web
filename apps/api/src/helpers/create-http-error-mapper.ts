// @file apps/api/src/helpers/create-http-error-mapper.ts
import type { ApplicationError } from "../types/application-error.types.js";
import type { HttpErrorDefinitions, HttpError } from "../types/http.types.js";

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
