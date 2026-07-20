// @file apps/api/src/helpers/create-success-response-schemas.ts

import type {
  HttpSuccessDefinition,
  HttpSuccessDefinitions,
} from "#types/http.types";

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
      },
    ]),
  );
}
