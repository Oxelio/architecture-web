export function oauthContinuation(search: string): string | undefined {
  const continuation = new URLSearchParams(search).get("continue");
  if (
    continuation &&
    /^\/oauth\/consent\/[A-Za-z0-9_-]{16,128}$/u.test(continuation)
  ) {
    return continuation;
  }
  return undefined;
}
