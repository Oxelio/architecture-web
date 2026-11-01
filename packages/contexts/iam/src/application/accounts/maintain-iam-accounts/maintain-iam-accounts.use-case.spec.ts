import { describe, expect, it, vi } from "vitest";

import type {
  AccountDeletionStore,
  AccountExportStore,
} from "#accounts/account-data/account-data.ports";
import type { SessionRepository } from "#ports/session.repository";

import { MaintainIamAccountsUseCase } from "./maintain-iam-accounts.use-case.js";

function fixture() {
  const userId = "0194091c-3842-7000-8000-000000000001";
  const due = vi.fn<AccountDeletionStore["due"]>().mockResolvedValue([
    {
      id: "cancelled-in-the-meantime",
      userId,
      previousStatus: "active",
      scheduledFor: new Date(),
      cancelledAt: null,
      executedAt: null,
    },
    {
      id: "due",
      userId,
      previousStatus: "active",
      scheduledFor: new Date(),
      cancelledAt: null,
      executedAt: null,
    },
  ]);
  const eraseIfDue = vi
    .fn<AccountDeletionStore["eraseIfDue"]>()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(userId);
  const expire = vi.fn<AccountExportStore["expire"]>();
  const deleteAllForUser = vi.fn<SessionRepository["deleteAllForUser"]>();
  const useCase = new MaintainIamAccountsUseCase(
    { due, eraseIfDue, request: vi.fn(), find: vi.fn(), cancel: vi.fn() },
    {
      expire,
      reserve: vi.fn(),
      readData: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      list: vi.fn(),
      take: vi.fn(),
    },
    {
      deleteAllForUser,
      save: vi.fn(),
      saveEnforcingMaximum: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn(),
      updateLastActivity: vi.fn(),
      findActiveForUser: vi.fn(),
    },
  );
  return { useCase, due, eraseIfDue, expire, deleteAllForUser, userId };
}

describe("account maintenance orchestration", () => {
  it("cleans sessions only for committed erasures and uses the same maintenance instant", async () => {
    const { useCase, due, eraseIfDue, expire, deleteAllForUser, userId } =
      fixture();
    const result = await useCase.execute();
    expect(result).toMatchObject({
      success: true,
      value: { deletedAccounts: 1 },
    });
    expect(deleteAllForUser).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ value: userId }),
    );
    const now = due.mock.calls[0]?.[0];
    expect(eraseIfDue.mock.calls).toEqual([
      ["cancelled-in-the-meantime", now],
      ["due", now],
    ]);
    expect(expire).toHaveBeenCalledExactlyOnceWith(now);
  });

  it("propagates an erasure failure without reporting completion or expiring exports", async () => {
    const { useCase, eraseIfDue, deleteAllForUser, expire } = fixture();
    eraseIfDue.mockReset().mockRejectedValue(new Error("database unavailable"));
    await expect(useCase.execute()).rejects.toThrow("database unavailable");
    expect(deleteAllForUser).not.toHaveBeenCalled();
    expect(expire).not.toHaveBeenCalled();
  });
});
