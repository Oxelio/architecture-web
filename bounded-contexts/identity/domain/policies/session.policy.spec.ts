import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { SessionPolicy } from "./session.policy.js";

describe("SessionPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* -------------------------------------------------- */
  /* EXPIRES AT                                          */
  /* -------------------------------------------------- */

  it("should compute expiration date 60 minutes in the future", () => {
    const now = new Date("2025-01-01T00:00:00.000Z").getTime();

    vi.setSystemTime(now);

    const result = SessionPolicy.expiresAt();

    const expected = now + 60 * 60 * 1000;

    expect(result.getTime()).toBe(expected);
  });

  it("should always respect totalMinutes configuration", () => {
    const now = Date.now();

    vi.setSystemTime(now);

    const result = SessionPolicy.expiresAt();

    const diff = result.getTime() - now;

    expect(diff).toBe(SessionPolicy.totalMinutes * 60 * 1000);
  });
});
