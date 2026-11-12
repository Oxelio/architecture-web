import { describe, expect, it, vi } from "vitest";

import { IamNotificationRecipientDirectoryAdapter } from "./iam-notification-recipient-directory.adapter.js";

describe("IamNotificationRecipientDirectoryAdapter", () => {
  it("maps only valid recipient identities and delegates current IAM reads", async () => {
    const recipients = {
      findRecipientContact: vi
        .fn()
        .mockResolvedValueOnce({ id: "user-1", email: "user@example.test" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "", email: null }),
      listActiveAdministratorIds: vi.fn().mockResolvedValue(["user-1"]),
      isActiveAdministrator: vi.fn().mockResolvedValue(true),
    };
    const eligibility = {
      readAffectedUserDeliveryEligibility: vi.fn().mockResolvedValue("erased"),
    };
    const directory = new IamNotificationRecipientDirectoryAdapter(
      recipients,
      eligibility,
    );

    const user = await directory.findUser("user-1");
    expect(user?.userId).toBe("user-1");
    expect(user?.destinationFor("email")).toBe("user@example.test");
    expect(user?.destinationFor("sms")).toBeNull();
    await expect(directory.findUser("missing")).resolves.toBeNull();
    await expect(directory.findUser("invalid")).rejects.toThrow(
      "Invalid IAM notification recipient identifier",
    );
    await expect(directory.listAdministratorIds()).resolves.toEqual(["user-1"]);
    await expect(directory.isActiveAdministrator("user-1")).resolves.toBe(true);
    await expect(
      directory.readAffectedUserDeliveryEligibility("user-1"),
    ).resolves.toBe("erased");
    expect(recipients.isActiveAdministrator).toHaveBeenCalledExactlyOnceWith(
      "user-1",
    );
    expect(
      eligibility.readAffectedUserDeliveryEligibility,
    ).toHaveBeenCalledExactlyOnceWith("user-1");
  });
});
