import { validate } from "uuid";
/** Resource identifiers are validated before they reach UUID persistence columns. */
export function isSecurityOperationId(value: string): boolean {
  return validate(value);
}
