import { describe, expect, it } from "vitest";

import { NotificationRecipientIdentifierValueObject } from "../value-objects/notification-recipient-identifier.value-object.js";
import { NotificationRecipientEntity } from "./notification-recipient.entity.js";

describe("NotificationRecipientEntity", () => {
  it("selects a destination according to the notification channel", () => {
    const identifier =
      NotificationRecipientIdentifierValueObject.create("user-1");
    if (!identifier.success) {
      throw new Error("Test fixture is invalid");
    }
    const recipient = NotificationRecipientEntity.create({
      identifier: identifier.value,
      email: " user@example.test ",
      phoneNumber: "+33123456789",
    });

    expect(recipient.destinationFor("email")).toBe("user@example.test");
    expect(recipient.destinationFor("sms")).toBe("+33123456789");
    expect(recipient.destinationFor("slack")).toBeNull();
  });
});
