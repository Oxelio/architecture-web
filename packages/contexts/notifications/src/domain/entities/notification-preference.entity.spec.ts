import { describe, expect, it } from "vitest";

import { NotificationChannelValueObject } from "../value-objects/notification-channel.value-object.js";
import { NotificationPreferenceEntity } from "./notification-preference.entity.js";

describe("NotificationPreferenceEntity", () => {
  it("owns the preference identity and transition", () => {
    const channel = NotificationChannelValueObject.create("email");
    if (!channel.success) {
      throw new Error("Test fixture is invalid");
    }
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");
    const preference = NotificationPreferenceEntity.create(
      "user-1",
      channel.value,
      true,
      createdAt,
    );

    expect(preference.identifier.value).toBe("user-1:email");
    expect(preference.update(false, updatedAt)).toBe(true);
    expect(preference.update(false, updatedAt)).toBe(false);
    expect(preference.enabled).toBe(false);
    expect(preference.updatedAt).toEqual(updatedAt);
  });
});
