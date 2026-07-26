// @file infrastructure/identity/persitence/kysely/src/adapters/kysely-email-verification.adapter.ts

import type {
  EmailVerificationRecord,
  EmailVerificationRepository,
} from "@architecture/identity/application";
import { UserIdentifierValueObject } from "@architecture/identity/domain";
import type { Kysely } from "kysely";

import type {
  IdentityDatabase,
  IdentityEmailVerificationRow,
} from "#persistence/schema";

export class KyselyEmailVerificationAdapter implements EmailVerificationRepository {
  constructor(private readonly db: Kysely<IdentityDatabase>) {}

  async save(
    userId: UserIdentifierValueObject,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const row: IdentityEmailVerificationRow = {
      token,
      user_id: userId.value,
      expires_at: expiresAt,
      used: false,
      invalidated: false,
      created_at: new Date(),
    };

    await this.db
      .insertInto("identity_email_verifications")
      .values(row)
      .execute();
  }

  async findByToken(token: string): Promise<EmailVerificationRecord | null> {
    const row = await this.db
      .selectFrom("identity_email_verifications")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const userIdResult = UserIdentifierValueObject.create(row.user_id);
    if (!userIdResult.success) {
      return null;
    }

    return {
      token: row.token,
      userId: userIdResult.value,
      expiresAt: row.expires_at,
      used: row.used,
      invalidated: row.invalidated,
    };
  }

  async markUsed(token: string): Promise<void> {
    await this.db
      .updateTable("identity_email_verifications")
      .set({ used: true })
      .where("token", "=", token)
      .execute();
  }

  async invalidatePrevious(userId: UserIdentifierValueObject): Promise<void> {
    await this.db
      .updateTable("identity_email_verifications")
      .set({
        invalidated: true,
      })
      .where("user_id", "=", userId.value)
      .where("invalidated", "=", false)
      .execute();
  }
}
