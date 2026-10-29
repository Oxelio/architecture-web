import type { GetUserAdministrationOverview } from "@architecture/iam/application";
import { describe, expect, it, vi } from "vitest";

import { createGetUserAdministrationOverviewController } from "./get-user-administration-overview.controller.js";

describe("user administration overview controller", () => {
  it("returns indicators as a separate data resource without empty meta", async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      value: { total: 12, active: 9, suspended: 3, administrators: 2 },
    });
    const send = vi.fn();
    const controller = createGetUserAdministrationOverviewController({
      execute,
    } as GetUserAdministrationOverview);

    await controller(
      { auth: { userId: "actor-id", role: "admin" } } as never,
      { status: vi.fn().mockReturnThis(), send } as never,
    );

    expect(execute).toHaveBeenCalledWith({ actorUserId: "actor-id" });
    expect(send).toHaveBeenCalledWith({
      data: { total: 12, active: 9, suspended: 3, administrators: 2 },
    });
  });
});
