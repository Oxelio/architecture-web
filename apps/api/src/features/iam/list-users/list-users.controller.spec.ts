import type { ListUsers } from "@architecture/iam/application";
import { describe, expect, it, vi } from "vitest";

import { createListUsersController } from "./list-users.controller.js";

describe("list users controller", () => {
  it("forwards validated query criteria and presents pagination in meta", async () => {
    const execute = vi.fn().mockResolvedValue({
      success: true,
      value: {
        users: [],
        pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2 },
      },
    });
    const send = vi.fn();
    const controller = createListUsersController({ execute } as ListUsers);

    await controller(
      {
        auth: { userId: "actor-id", role: "admin" },
        query: {
          search: "alice",
          role: "user",
          status: "active",
          emailVerified: true,
          page: 2,
          pageSize: 10,
        },
      } as never,
      { status: vi.fn().mockReturnThis(), send } as never,
    );

    expect(execute).toHaveBeenCalledWith({
      actorUserId: "actor-id",
      search: "alice",
      role: "user",
      status: "active",
      isEmailVerified: true,
      page: 2,
      pageSize: 10,
    });
    expect(send).toHaveBeenCalledWith({
      data: [],
      meta: {
        pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2 },
      },
    });
  });
});
