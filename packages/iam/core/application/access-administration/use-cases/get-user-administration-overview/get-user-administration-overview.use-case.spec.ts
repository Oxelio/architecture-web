import { describe, expect, it, vi } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import type { UserRepository } from "#repositories/user.repository";

import { GetUserAdministrationOverviewUseCase } from "./get-user-administration-overview.use-case.js";

describe("GetUserAdministrationOverviewUseCase", () => {
  it("returns global indicators to an administrator", async () => {
    const administrator = createAdministrator();
    const getAdministrationOverview = vi.fn(async () => ({
      total: 142,
      active: 130,
      suspended: 12,
      administrators: 4,
    }));
    const users = {
      findById: async () => administrator,
      getAdministrationOverview,
    } as unknown as UserRepository;

    const result = await new GetUserAdministrationOverviewUseCase(
      users,
    ).execute({ actorUserId: administrator.identifier.value });

    expect(result).toEqual({
      success: true,
      value: {
        total: 142,
        active: 130,
        suspended: 12,
        administrators: 4,
      },
    });
    expect(getAdministrationOverview).toHaveBeenCalledOnce();
  });

  it("does not expose indicators to a non-administrator", async () => {
    const getAdministrationOverview = vi.fn();
    const users = {
      findById: async () => null,
      getAdministrationOverview,
    } as unknown as UserRepository;

    const result = await new GetUserAdministrationOverviewUseCase(
      users,
    ).execute({ actorUserId: "not-an-identifier" });

    expect(result).toEqual({
      success: false,
      error: { code: "administrator.unauthorized" },
    });
    expect(getAdministrationOverview).not.toHaveBeenCalled();
  });
});
