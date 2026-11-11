import { describe, expect, it, vi } from "vitest";

import { KyselyIamNotificationRecipientDirectoryAdapter } from "./kysely-iam-notification-recipient-directory.adapter.js";

const readEligibility = vi.fn();

describe("KyselyIamNotificationRecipientDirectoryAdapter", () => {
  it.each([true, false])(
    "checks current active membership: %s",
    async (eligible) => {
      const query = {
        select: vi.fn(),
        where: vi.fn(),
        executeTakeFirst: vi
          .fn()
          .mockResolvedValue(eligible ? { id: "admin" } : undefined),
      };
      query.select.mockReturnValue(query);
      query.where.mockReturnValue(query);
      const adapter = new KyselyIamNotificationRecipientDirectoryAdapter(
        {
          selectFrom: vi.fn().mockReturnValue(query),
        } as never,
        readEligibility,
      );
      expect(await adapter.isActiveAdministrator("admin")).toBe(eligible);
      expect(query.where.mock.calls).toEqual([
        ["id", "=", "admin"],
        ["role", "=", "admin"],
        ["status", "=", "active"],
      ]);
    },
  );
  it("maps an IAM user without exposing IAM domain internals", async () => {
    const query = {
      leftJoin: vi.fn(),
      select: vi.fn(),
      where: vi.fn(),
      executeTakeFirst: vi
        .fn()
        .mockResolvedValue({ id: "user-1", email: "user@example.test" }),
    };
    query.leftJoin.mockImplementation((_table, callback) => {
      const join = {
        onRef: vi.fn(),
        on: vi.fn(),
      };
      join.onRef.mockReturnValue(join);
      join.on.mockReturnValue(join);
      callback(join);
      return query;
    });
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const db = { selectFrom: vi.fn().mockReturnValue(query) };
    const adapter = new KyselyIamNotificationRecipientDirectoryAdapter(
      db as never,
      readEligibility,
    );

    const recipient = await adapter.findUser("user-1");

    expect(recipient?.userId).toBe("user-1");
    expect(recipient?.destinationFor("email")).toBe("user@example.test");
  });

  it("lists active IAM administrators", async () => {
    const query = {
      select: vi.fn(),
      where: vi.fn(),
      execute: vi
        .fn()
        .mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]),
    };
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const db = { selectFrom: vi.fn().mockReturnValue(query) };
    const adapter = new KyselyIamNotificationRecipientDirectoryAdapter(
      db as never,
      readEligibility,
    );

    await expect(adapter.listAdministratorIds()).resolves.toEqual([
      "admin-1",
      "admin-2",
    ]);
  });

  it("delegates affected-user eligibility to the IAM application reader", async () => {
    readEligibility.mockResolvedValueOnce("erased");
    const adapter = new KyselyIamNotificationRecipientDirectoryAdapter(
      {} as never,
      readEligibility,
    );
    await expect(
      adapter.readAffectedUserDeliveryEligibility("user-1"),
    ).resolves.toBe("erased");
    expect(readEligibility).toHaveBeenCalledWith("user-1");
  });
});
