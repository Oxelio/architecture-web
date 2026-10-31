/** Process-local lifecycle only; database claims coordinate different processes. */
export function startBackgroundPolling(
  work: () => Promise<unknown>,
  onError: (error: unknown) => void,
  intervalMs = 1_000,
): () => Promise<void> {
  let active: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (active) {
      return;
    }
    active = Promise.resolve()
      .then(work)
      .then(() => undefined)
      .catch(onError)
      .finally(() => {
        active = undefined;
      });
  }, intervalMs);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await active;
  };
}
