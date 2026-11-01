import { describe, expect, it } from "vitest";

import { recoveryErrorMessage, recoverySubmitLabel } from "./RecoveryPage";

describe("recovery form feedback", () => {
  it.each([
    [new Error("password.too_short"), "passwordFeedback.too_short"],
    [
      new Error("password_recovery.invalid_token"),
      "passwordFeedback.recovery_invalid",
    ],
    [new Error("email.invalid_format"), "auth.invalidEmail"],
    [new Error("transport.unavailable"), "passwordFeedback.unavailable"],
    [null, "passwordFeedback.unavailable"],
  ])("preserves feedback for %s", (error, expected) => {
    const translate = (key: string) => key;
    expect(recoveryErrorMessage(error, translate as never)).toBe(expected);
  });
  it.each([
    [true, true, "Traitement…"],
    [true, false, "Traitement…"],
    [false, true, "Réinitialiser"],
    [false, false, "Envoyer les instructions"],
  ])(
    "preserves the pending=%s and reset=%s button label",
    (pending, reset, expected) => {
      expect(recoverySubmitLabel(pending, reset)).toBe(expected);
    },
  );
});
