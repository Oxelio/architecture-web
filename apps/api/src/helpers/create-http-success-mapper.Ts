import type { HttpSuccessDefinition } from "../types/http.types.js";

export function createHttpSuccessMapper<
  const TSuccess extends Record<string, HttpSuccessDefinition>,
>(mapping: TSuccess) {
  return (code: keyof TSuccess) => {
    return mapping[code];
  };
}
