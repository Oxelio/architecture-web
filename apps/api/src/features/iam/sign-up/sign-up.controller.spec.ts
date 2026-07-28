import type { SignUp } from "@architecture/iam/application";
import { describe, expect, it, vi } from "vitest";

import { createSignUpController } from "./sign-up.controller.js";

describe("sign-up controller password contract", () => {
  it("forwards password confirmation without including secrets in the response", async () => {
    const execute = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "password.confirmation_mismatch" },
    });
    const send = vi.fn();
    const controller = createSignUpController({ execute } as SignUp);

    await controller(
      {
        body: {
          email: "user@example.test",
          password: "first secret phrase",
          passwordConfirmation: "second secret phrase",
        },
      } as never,
      {
        status: vi.fn().mockReturnThis(),
        send,
      } as never,
    );

    expect(execute).toHaveBeenCalledWith({
      email: "user@example.test",
      password: "first secret phrase",
      passwordConfirmation: "second secret phrase",
    });
    expect(JSON.stringify(send.mock.calls)).not.toContain("secret phrase");
  });
});
