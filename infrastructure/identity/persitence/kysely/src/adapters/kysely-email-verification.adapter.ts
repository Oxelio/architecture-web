import type { Kysely } from "kysely";
import type {
  EmailVerificationPort,
  EmailVerificationRecord,
} from "@architecture/identity/application";
import type {
  IdentityDatabase,
  IdentityEmailVerificationRow,
} from "../persistence/schema.js";
import { UserIdentifierValueObject } from "@architecture/identity/domain";

export class KyselyEmailVerificationAdapter implements EmailVerificationPort {
  constructor(private readonly db: Kysely<IdentityDatabase>) {}

  async create(
    userId: UserIdentifierValueObject,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const row: Partial<IdentityEmailVerificationRow> = {
      token,
      user_id: userId.value,
      expires_at: expiresAt,
      used: false,
      created_at: new Date(),
    };

    await this.db
      .insertInto("identity_email_verifications")
      .values(row as any)
      .execute();
  }

  async findByToken(token: string): Promise<EmailVerificationRecord | null> {
    const row = await this.db
      .selectFrom("identity_email_verifications")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();

    if (!row) return null;

    const userIdResult = UserIdentifierValueObject.create(row.user_id);
    if (!userIdResult.success) return null;

    return {
      token: row.token,
      userId: userIdResult.value,
      expiresAt: row.expires_at,
      used: row.used,
    } as unknown as EmailVerificationRecord;
  }

  async markUsed(token: string): Promise<void> {
    await this.db
      .updateTable("identity_email_verifications")
      .set({ used: true })
      .where("token", "=", token)
      .execute();
  }
}
