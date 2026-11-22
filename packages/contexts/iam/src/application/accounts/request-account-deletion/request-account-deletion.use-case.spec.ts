import { Result } from "@architecture/foundation";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SECURITY_POLICY } from "#domain/security-policy";
import { UserEntity } from "#entities/user.entity";

import { RequestAccountDeletionUseCase } from "./request-account-deletion.use-case.js";

function fixture(acceptedOutcome: "saved" | "grace_period_changed" | "disabled" = "saved", enabled = true) {
  const user = UserEntity.create();
  const reauthentication = { strong: vi.fn(async () => Result.success(undefined)) };
  const store = { request: vi.fn(async () => acceptedOutcome) };
  const sessions = { deleteAllForUser: vi.fn(async () => undefined) };
  const mail = { sendDeletionCancellation: vi.fn(async () => undefined) };
  const tokens = {
    identifier: () => "deletion-id",
    generate: () => "secret",
    hash: () => "hash",
  };
  const useCase = new RequestAccountDeletionUseCase(
    {
      getAccountSecurityPolicy: async () => ({
        accounts: {
          ...DEFAULT_SECURITY_POLICY.accounts,
          deletion: enabled,
          deletionGraceDays: 30,
        },
        authentication: DEFAULT_SECURITY_POLICY.authentication,
      }),
    },
    reauthentication as never,
    { findById: async () => user } as never,
    { findForUser: async () => null } as never,
    store as never,
    tokens as never,
    mail as never,
    sessions as never,
  );
  const command = {
    userId: user.identifier.value,
    sessionId: "session-id",
    password: "password-proof",
    confirmation: "DELETE",
    confirmedGracePeriodDays: 30,
  };
  return { user, command, useCase, reauthentication, store, sessions, mail };
}

describe("account deletion consent and transaction outcome", () => {
  it("refuses a stale disclosed duration before consuming strengthened proof", async () => {
    const f = fixture();
    const result = await f.useCase.execute({
      ...f.command,
      confirmedGracePeriodDays: 14,
    });
    expect(result).toEqual({
      success: false,
      error: { code: "account_deletion.grace_period_changed" },
    });
    expect(f.reauthentication.strong).not.toHaveBeenCalled();
    expect(f.store.request).not.toHaveBeenCalled();
    expect(f.sessions.deleteAllForUser).not.toHaveBeenCalled();
  });

  it("refuses a disabled policy before proof and persistence", async () => {
    const f = fixture("saved", false);
    const result = await f.useCase.execute(f.command);
    expect(result).toEqual({
      success: false,
      error: { code: "account_deletion.disabled" },
    });
    expect(f.reauthentication.strong).not.toHaveBeenCalled();
    expect(f.store.request).not.toHaveBeenCalled();
  });

  it("passes the confirmed duration to the transaction without treating it as the schedule", async () => {
    const f = fixture();
    const before = Date.now();
    const result = await f.useCase.execute(f.command);
    expect(result.success).toBe(true);
    expect(f.store.request).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmedGracePeriodDays: 30,
        scheduledFor: expect.any(Date),
      }),
    );
    const input = f.store.request.mock.calls[0]?.[0] as unknown as {
      scheduledFor: Date;
      now: Date;
    };
    expect(input.scheduledFor.getTime() - input.now.getTime()).toBe(
      30 * 86_400_000,
    );
    expect(input.scheduledFor.getTime()).toBeGreaterThan(before);
    expect(f.sessions.deleteAllForUser).toHaveBeenCalledOnce();
  });

  it("does not revoke sessions or notify after a late policy change", async () => {
    const f = fixture("grace_period_changed");
    const result = await f.useCase.execute(f.command);
    expect(result).toEqual({
      success: false,
      error: { code: "account_deletion.grace_period_changed" },
    });
    expect(f.reauthentication.strong).toHaveBeenCalledOnce();
    expect(f.sessions.deleteAllForUser).not.toHaveBeenCalled();
    expect(f.mail.sendDeletionCancellation).not.toHaveBeenCalled();
  });

  it("does not revoke sessions when deletion is disabled at persistence time", async () => {
    const f = fixture("disabled");
    const result = await f.useCase.execute(f.command);
    expect(result).toEqual({
      success: false,
      error: { code: "account_deletion.disabled" },
    });
    expect(f.sessions.deleteAllForUser).not.toHaveBeenCalled();
  });
});
