import { describe, expect, it } from "vitest";

import { SignUpPresenter } from "./sign-up.presenter.js";

describe("registration error presentation", () => {
  it("presents the created user identifier in the response envelope", () => {
    expect(
      SignUpPresenter.toPresentation({
        success: true,
        value: { userId: "user-123" },
      }),
    ).toMatchObject({
      status: 201,
      body: { data: { userId: "user-123" } },
    });
  });

  it.each([
    ["registration.disabled", 403],
    ["login_identifier.empty", 400],
    ["login_identifier.invalid_kind", 400],
    ["login_identifier.invalid_email", 400],
    ["login_identifier.invalid_username", 400],
    ["login_identifier.not_allowed", 400],
  ] as const)(
    "presents %s without falling back to a technical error",
    (code, status) => {
      expect(
        SignUpPresenter.toPresentation({ success: false, error: { code } }),
      ).toMatchObject({
        status,
        body: { error: { code } },
      });
    },
  );
});
