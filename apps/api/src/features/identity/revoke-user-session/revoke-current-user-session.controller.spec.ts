import type { RevokeUserSession } from "@architecture/identity/application";
import { describe, expect, it, vi } from "vitest";

import { createRevokeCurrentUserSessionController } from "./revoke-current-user-session.controller.js";

describe("revoke current user session controller", () => {
  it("derives the owner from auth and clears the cookie for the current session", async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      value: undefined,
    });
    const clearCookie = vi.fn();
    const send = vi.fn();
    const controller = createRevokeCurrentUserSessionController(
      { execute } as RevokeUserSession,
      { name: "sid", options: { httpOnly: true } },
    );

    await controller(
      {
        auth: {
          userId: "01900000-0000-7000-8000-000000000001",
          sessionId: "01900000-0000-7000-8000-000000000002",
          role: "user",
        },
        params: {
          sessionId: "01900000-0000-7000-8000-000000000002",
        },
      } as never,
      {
        clearCookie,
        status: vi.fn().mockReturnThis(),
        send,
      } as never,
    );

    expect(execute).toHaveBeenCalledWith({
      userId: "01900000-0000-7000-8000-000000000001",
      sessionId: "01900000-0000-7000-8000-000000000002",
    });
    expect(clearCookie).toHaveBeenCalledWith("sid", { httpOnly: true });
  });
});
