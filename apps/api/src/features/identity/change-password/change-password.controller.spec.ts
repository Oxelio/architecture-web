import type { ChangePassword } from "@architecture/identity/application";
import { describe, expect, it, vi } from "vitest";

import { createChangePasswordController } from "./change-password.controller.js";

describe("change-password controller contract", () => {
  it("derives the user and forwards current, new, and confirmation values", async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      value: undefined,
    });
    const send = vi.fn();
    const controller = createChangePasswordController({
      execute,
    } as ChangePassword);

    await controller(
      {
        auth: {
          userId: "01900000-0000-7000-8000-000000000001",
          sessionId: "01900000-0000-7000-8000-000000000002",
          role: "user",
        },
        body: {
          currentPassword: "current secret phrase",
          password: "new secret phrase",
          passwordConfirmation: "new secret phrase",
        },
      } as never,
      {
        status: vi.fn().mockReturnThis(),
        send,
      } as never,
    );

    expect(execute).toHaveBeenCalledWith({
      userId: "01900000-0000-7000-8000-000000000001",
      currentPassword: "current secret phrase",
      password: "new secret phrase",
      passwordConfirmation: "new secret phrase",
    });
    expect(JSON.stringify(send.mock.calls)).not.toContain("secret phrase");
  });
});
