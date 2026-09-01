const sensitiveKey = /(password|token|secret|cookie|authorization|code)/i;

export function redactAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAuditMetadata);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? "[REDACTED]" : redactAuditMetadata(item),
      ]),
    );
  }
  return value;
}
