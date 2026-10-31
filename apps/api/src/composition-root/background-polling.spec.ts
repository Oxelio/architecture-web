import { afterEach, describe, expect, it, vi } from "vitest";

import { startBackgroundPolling } from "./background-polling.js";

afterEach(() => vi.useRealTimers());
describe("background polling", () => {
  it("does not overlap, waits on shutdown and never polls after stopping", async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    const work = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const stop = startBackgroundPolling(work, vi.fn());
    await vi.advanceTimersByTimeAsync(4000);
    expect(work).toHaveBeenCalledOnce();
    let stopped = false;
    const stopping = stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    complete();
    await stopping;
    expect(stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(work).toHaveBeenCalledOnce();
  });
  it("reports a failure and resumes polling", async () => {
    vi.useFakeTimers();
    const failure = new Error("failed"),
      onError = vi.fn();
    const work = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    const stop = startBackgroundPolling(work, onError);
    await vi.advanceTimersByTimeAsync(2000);
    await stop();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(work).toHaveBeenCalledTimes(2);
  });
});
