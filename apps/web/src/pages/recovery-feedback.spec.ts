import { describe, expect, it } from "vitest";

import { recoverySubmitLabel } from "./RecoveryPage";

describe("recovery form feedback", () => {
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
