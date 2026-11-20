import { describe, expect, it } from "vitest";

import i18n from "#app/i18n";

import { recoverySubmitKey } from "./RecoveryPage";

describe("recovery form feedback", () => {
  it.each([
    [true, true, "recovery.pending", "Traitement…", "Processing…"],
    [true, false, "recovery.pending", "Traitement…", "Processing…"],
    [false, true, "recovery.resetSubmit", "Réinitialiser", "Reset password"],
    [
      false,
      false,
      "recovery.requestSubmit",
      "Envoyer les instructions",
      "Send instructions",
    ],
  ])(
    "localizes the pending=%s and reset=%s button label",
    (pending, reset, expectedKey, french, english) => {
      const key = recoverySubmitKey(pending, reset);
      expect(key).toBe(expectedKey);
      expect(i18n.getFixedT("fr")(key)).toBe(french);
      expect(i18n.getFixedT("en")(key)).toBe(english);
    },
  );
});
