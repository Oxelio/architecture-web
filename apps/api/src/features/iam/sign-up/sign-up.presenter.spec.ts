import type { SignUpOutput } from "@architecture/iam/application";
import { describe, expect, it } from "vitest";

import { SignUpPresenter } from "./sign-up.presenter.js";

describe("SignUpPresenter", () => {
  it("presents the created user identifier in the response envelope", () => {
    const result = {
      success: true,
      value: { userId: "user-123" },
    } as SignUpOutput;
    const response = SignUpPresenter.toPresentation(result);

    expect(response).toMatchObject({
      status: 201,
      body: {
        data: {
          userId: "user-123",
        },
      },
    });
  });
});
