import {
  EmailVerificationEntity,
  EmailVerificationTokenHashValueObject,
  LoginIdentityIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import { describe, expect, it, vi } from "vitest";

import { KyselyEmailVerificationAdapter } from "./kysely-email-verification.adapter.js";

const userId = {
  success: true as const,
  value: UserIdentifierValueObject.generate(),
};
const token = EmailVerificationTokenHashValueObject.create("a".repeat(64));
const loginIdentityId = LoginIdentityIdentifierValueObject.generate();
if (!userId.success || !token.success) {
  throw new Error("invalid fixture");
}
const row = {
  token_hash: token.value.value,
  user_id: userId.value.value,
  login_identity_id: loginIdentityId.value,
  expires_at: new Date(Date.now() + 60_000),
  used: false,
  invalidated: false,
  created_at: new Date(),
};

function dbWith(result: unknown) {
  const execute = vi.fn().mockResolvedValue(undefined);
  const executeTakeFirst = vi.fn().mockResolvedValue(result);
  const chain = {
    values: vi.fn(),
    set: vi.fn(),
    selectAll: vi.fn(),
    where: vi.fn(),
    execute,
    executeTakeFirst,
  };
  chain.values.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.selectAll.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return {
    insertInto: vi.fn(() => chain),
    selectFrom: vi.fn(() => chain),
    updateTable: vi.fn(() => chain),
    chain,
  };
}

describe("KyselyEmailVerificationAdapter", () => {
  it("saves, reads and invalidates verifications", async () => {
    const db = dbWith({ numUpdatedRows: 1n });
    const adapter = new KyselyEmailVerificationAdapter(db as never);
    await adapter.save(
      EmailVerificationEntity.create({
        userId: userId.value,
        loginIdentityId,
        tokenHash: token.value,
        expiresAt: row.expires_at,
      }),
    );
    expect(db.insertInto).toHaveBeenCalledWith("iam_email_verifications");
    await expect(adapter.consume(token.value, new Date())).resolves.toBe(true);
    await adapter.invalidatePreviousFor(loginIdentityId);
    expect(db.updateTable).toHaveBeenCalledTimes(2);
  });

  it("returns null for missing or invalid stored data and rehydrates valid data", async () => {
    const adapter = new KyselyEmailVerificationAdapter(dbWith(null) as never);
    await expect(adapter.findByToken(token.value)).resolves.toBeNull();
    await expect(
      new KyselyEmailVerificationAdapter(
        dbWith({ ...row, user_id: "bad" }) as never,
      ).findByToken(token.value),
    ).resolves.toBeNull();
    await expect(
      new KyselyEmailVerificationAdapter(
        dbWith({ ...row, token_hash: "bad" }) as never,
      ).findByToken(token.value),
    ).resolves.toBeNull();
    await expect(
      new KyselyEmailVerificationAdapter(dbWith(row) as never).findByToken(
        token.value,
      ),
    ).resolves.toMatchObject({ userId: userId.value, tokenHash: token.value });
    await expect(
      new KyselyEmailVerificationAdapter(
        dbWith({ numUpdatedRows: 0n }) as never,
      ).consume(token.value, new Date()),
    ).resolves.toBe(false);
  });
});
