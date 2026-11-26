import { Result } from "@architecture/foundation";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SECURITY_POLICY } from "#domain/security-policy";
import { SessionEntity } from "#entities/session.entity";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { CriticalConfigurationConfirmation } from "./critical-configuration-confirmation.js";
import type { CriticalConfigurationConfirmationStore } from "./critical-configuration-confirmation.store.js";

function fixture() {
  const userId = UserIdentifierValueObject.generate();
  const session = SessionEntity.createForUser({
    userId,
    userSessionVersion: 1,
    expiresAt: new Date(Date.now() + 300_000),
  });
  const state = { comparison: "opaque", sessionVersion: 1, mfaEnabled: false };
  const store = {
    admit: vi.fn<CriticalConfigurationConfirmationStore["admit"]>(
      async (_input, eligible) => {
        const error = eligible(state);
        return error ? Result.failure(error) : Result.success(state);
      },
    ),
    authorize: vi.fn<CriticalConfigurationConfirmationStore["authorize"]>(
      async (_id, _state, check) => check(),
    ),
  };
  const sessions = { findById: vi.fn(async () => session) };
  const password = { password: vi.fn(async () => Result.success(undefined)) };
  const factor = { verify: vi.fn(async () => Result.success("totp" as const)) };
  let elapsed = 0;
  return {
    confirmation: new CriticalConfigurationConfirmation(
      store,
      sessions,
      password,
      factor,
      () => elapsed,
    ),
    store,
    sessions,
    password,
    factor,
    session,
    setElapsed: (time: number) => {
      elapsed = time;
    },
    input: {
      actorId: userId.value,
      sessionId: session.identifier.value,
      expectedVersion: 1,
      password: "test credentials",
      authentication: DEFAULT_SECURITY_POLICY.authentication,
      startedAt: 0,
    },
  };
}

describe("critical configuration confirmation timing", () => {
  it.each([119_999, 120_000])(
    "checks the exclusive deadline after the final Redis read at %d ms",
    async (time) => {
      const f = fixture();
      f.setElapsed(119_990);
      f.sessions.findById
        .mockResolvedValueOnce(f.session)
        .mockImplementationOnce(async () => {
          f.setElapsed(time);
          return f.session;
        });
      expect(await f.confirmation.verify(f.input)).toEqual(
        time === 119_999
          ? Result.success(1)
          : Result.failure("confirmation_refused"),
      );
    },
  );

  it("refuses at the attempt deadline even with a pending session read", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const f = fixture();
      f.setElapsed(119_980);
      const read = Promise.withResolvers<SessionEntity>();
      f.sessions.findById
        .mockResolvedValueOnce(f.session)
        .mockReturnValueOnce(read.promise);
      const attempt = f.confirmation.verify(f.input);
      await vi.advanceTimersByTimeAsync(20);
      await expect(attempt).resolves.toEqual(
        Result.failure("confirmation_refused"),
      );
      read.resolve(f.session);
      await vi.advanceTimersByTimeAsync(0);
      expect(f.store.authorize).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the original admission error and never verifies a credential after it", async () => {
    const f = fixture();
    const unavailable = new Error("database unavailable");
    f.store.admit.mockRejectedValue(unavailable);
    await expect(f.confirmation.verify(f.input)).rejects.toBe(unavailable);
    expect(f.password.password).not.toHaveBeenCalled();
    expect(f.store.authorize).not.toHaveBeenCalled();
  });

  it.each([119_999, 120_000])(
    "propagates a final read failure only when it arrives before the deadline at %d ms",
    async (time) => {
      const f = fixture();
      f.setElapsed(119_990);
      const failure = new Error("fixture Redis read failed");
      f.sessions.findById
        .mockResolvedValueOnce(f.session)
        .mockImplementationOnce(async () => {
          f.setElapsed(time);
          throw failure;
        });
      const attempt = f.confirmation.verify(f.input);
      if (time === 119_999) {
        await expect(attempt).rejects.toBe(failure);
      } else {
        await expect(attempt).resolves.toEqual(
          Result.failure("confirmation_refused"),
        );
      }
    },
  );

  it("ignores optional MFA input when MFA is disabled", async () => {
    const f = fixture();
    expect(
      await f.confirmation.verify({ ...f.input, mfaCode: "ignored" }),
    ).toEqual(Result.success(1));
    expect(f.factor.verify).not.toHaveBeenCalled();
  });
});
