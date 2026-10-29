// @file apps/api/src/helpers/create-http-success-mapper.ts

import type { HttpSuccessDefinition } from "#types/http.types";

export function createHttpSuccessMapper<
  const TSuccess extends Record<string, HttpSuccessDefinition>,
>(mapping: TSuccess) {
  return (code: keyof TSuccess) => {
    return mapping[code];
  };
}
