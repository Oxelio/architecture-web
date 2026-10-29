import { describe, expectTypeOf, it } from "vitest";

import type { ResetRecoveredPasswordError } from "#accounts/reset-recovered-password/reset-recovered-password.contracts";
import type { SignUpError } from "#accounts/sign-up/sign-up.contracts";
import type { PlainPasswordError } from "#value-objects/password-plain.value-object";

import type { IamSecurityApplication } from "./create-iam-security.js";

type SecurityOutput = Awaited<
  ReturnType<IamSecurityApplication[keyof IamSecurityApplication]["execute"]>
>;
type SecurityError = Extract<SecurityOutput, { success: false }>["error"];
type HasClosedCodes<E extends { code: string }> = string extends E["code"]
  ? false
  : true;

describe("public application error contracts", () => {
  it("enumerates security and registration failures without widening to string", () => {
    expectTypeOf<HasClosedCodes<SecurityError>>().toEqualTypeOf<true>();
    expectTypeOf<HasClosedCodes<SignUpError>>().toEqualTypeOf<true>();
  });

  it("preserves password failure discriminants and diagnostic fields", () => {
    expectTypeOf<PlainPasswordError["code"]>().toEqualTypeOf<
      "password.empty" | "password.too_long"
    >();
    expectTypeOf<
      Extract<ResetRecoveredPasswordError, { code: "password.too_short" }>
    >().toEqualTypeOf<{
      readonly code: "password.too_short";
      readonly actual: number;
      readonly min: number;
    }>();
  });
});
