import { describe, expect, it, vi } from "vitest";

import { KyselyIamNotificationRecipientDirectoryAdapter } from "./kysely-iam-notification-recipient-directory.adapter.js";

describe("KyselyIamNotificationRecipientDirectoryAdapter", () => {
  it("maps an IAM user without exposing IAM domain internals", async () => {
    const query = {
      select: vi.fn(),
      where: vi.fn(),
      executeTakeFirst: vi
        .fn()
        .mockResolvedValue({ id: "user-1", email: "user@example.test" }),
    };
    query.select.mockReturnValue(query);
    query.where.mockReturnValue(query);
    const db = { selectFrom: vi.fn().mockReturnValue(query) };
    const adapter = new KyselyIamNotificationRecipientDirectoryAdapter(
      db as never,
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
    );

    await expect(adapter.listAdministratorIds()).resolves.toEqual([
      "admin-1",
      "admin-2",
    ]);
  });
});
