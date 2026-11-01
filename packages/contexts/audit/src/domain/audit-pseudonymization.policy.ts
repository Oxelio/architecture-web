/** Replace only references to the deleted account; preserve unrelated evidence. */
export function pseudonymizeAuditMetadata(
  value: string,
  replacements: ReadonlyMap<string, string>,
): string;
export function pseudonymizeAuditMetadata(
  value: unknown,
  replacements: ReadonlyMap<string, string>,
): unknown;
export function pseudonymizeAuditMetadata(
  value: unknown,
  replacements: ReadonlyMap<string, string>,
): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const [identifier, reference] of replacements) {
      result = result.replaceAll(identifier, reference);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => pseudonymizeAuditMetadata(item, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        pseudonymizeAuditMetadata(key, replacements),
        pseudonymizeAuditMetadata(item, replacements),
      ]),
    );
  }
  return value;
}
