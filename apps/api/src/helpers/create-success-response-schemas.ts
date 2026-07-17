// @file apps/api/src/helpers/create-success-response-schemas.ts
import type {
  HttpSuccessDefinitions,
  HttpSuccessDefinition,
} from "../types/http.types.js";

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
