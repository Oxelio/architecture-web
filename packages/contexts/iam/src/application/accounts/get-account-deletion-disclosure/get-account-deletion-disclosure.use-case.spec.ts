import { describe, expect, it } from "vitest";

import { DEFAULT_SECURITY_POLICY } from "#domain/security-policy";

import { GetAccountDeletionDisclosureUseCase } from "./get-account-deletion-disclosure.use-case.js";

describe("account deletion disclosure", () => {
  it.each([1, 14, 30, 90])(
    "reads the effective %i-day period without a default fallback",
    async (days) => {
      const useCase = new GetAccountDeletionDisclosureUseCase({
        getAccountPolicy: async () => ({
          ...DEFAULT_SECURITY_POLICY.accounts,
          deletionGraceDays: days,
        }),
      });
      expect(await useCase.execute()).toEqual({
        success: true,
        value: { enabled: true, gracePeriodDays: days },
      });
    },
  );

  it("does not invent availability when deletion is disabled", async () => {
    const useCase = new GetAccountDeletionDisclosureUseCase({
      getAccountPolicy: async () => ({
        ...DEFAULT_SECURITY_POLICY.accounts,
        deletion: false,
        deletionGraceDays: 90,
      }),
    });
    expect(await useCase.execute()).toEqual({
      success: true,
      value: { enabled: false, gracePeriodDays: 90 },
    });
  });

  it("propagates a failed effective-policy read instead of providing a default", async () => {
    const failure = new Error("published configuration unavailable");
    const useCase = new GetAccountDeletionDisclosureUseCase({
      getAccountPolicy: async () => {
        throw failure;
      },
    });
    await expect(useCase.execute()).rejects.toBe(failure);
  });
});
