import type {
  PublishedConfigurationReader,
  UserQueryRepository,
} from "@architecture/iam/application";
import { describe, expect, it, vi } from "vitest";

import { IamAuditAccessAdapter } from "./iam-audit-access.adapter.js";

describe("IAM to Audit authorization projection", () => {
  it.each([
    null,
    { status: "suspended", role: "admin" },
    { status: "active", role: "user" },
    { status: "active", role: "admin" },
  ])(
    "reads authoritative state without trusting transport roles: %j",
    async (actor) => {
      const findAccountById = vi.fn().mockResolvedValue(actor);
      const reader = {
        readPublished: async () => ({
          values: { audit: { consultation: true, retentionDays: 365 } },
        }),
      } as unknown as PublishedConfigurationReader;
      const access = new IamAuditAccessAdapter(
        { findAccountById } as unknown as UserQueryRepository,
        reader,
      );
      expect(await access.resolveActor("actor")).toEqual({
        active: actor?.status === "active",
        administrator: actor?.role === "admin",
        consultationEnabled: true,
        retentionDays: 365,
      });
      expect(findAccountById).toHaveBeenCalledWith("actor");
    },
  );
  it("propagates a policy storage failure instead of granting access", async () => {
    const failure = new Error("policy unavailable");
    const access = new IamAuditAccessAdapter(
      {
        findAccountById: vi.fn().mockResolvedValue(null),
      } as unknown as UserQueryRepository,
      {
        readPublished: vi.fn().mockRejectedValue(failure),
      } as unknown as PublishedConfigurationReader,
    );
    await expect(access.resolveActor("actor")).rejects.toBe(failure);
  });
});
