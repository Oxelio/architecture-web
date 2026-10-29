// @file apps/api/src/helpers/create-http-error-mapper.ts

import type { ApplicationError } from "#types/application-error.types";
import type { HttpError, HttpErrorDefinitions } from "#types/http.types";

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
            code: "internal.unexpected_error",
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
        },
      },
    };
  };
}
