import { describe, expect, it, vi } from "vitest";

import { KyselyEmailVerificationAdapter } from "./kysely-email-verification.adapter.js";
import { KyselyIamUnitOfWorkAdapter } from "./kysely-iam-unit-of-work.adapter.js";
import { KyselyUserAdapter } from "./kysely-user.adapter.js";

describe("KyselyIamUnitOfWorkAdapter", () => {
  it("provides repositories bound to one Kysely transaction", async () => {
    const transaction = {};
    const execute = vi.fn(async (work: (trx: object) => Promise<string>) =>
      work(transaction),
    );
    const db = {
      transaction: vi.fn(() => ({ execute })),
    };
    const unitOfWork = new KyselyIamUnitOfWorkAdapter(db as never);

    const result = await unitOfWork.execute(
      async ({ emailVerifications, users }) => {
        expect(users).toBeInstanceOf(KyselyUserAdapter);
        expect(emailVerifications).toBeInstanceOf(
          KyselyEmailVerificationAdapter,
        );
        return "committed";
      },
    );

    expect(result).toBe("committed");
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("propagates a transaction failure", async () => {
    const failure = new Error("rollback");
    const db = {
      transaction: () => ({
        execute: async (work: (trx: object) => Promise<unknown>) => work({}),
      }),
    };
    const unitOfWork = new KyselyIamUnitOfWorkAdapter(db as never);

    await expect(
      unitOfWork.execute(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
