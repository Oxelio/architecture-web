import type { IamDatabase } from "@architecture/iam-persistence-kysely";
import { NotificationRecipientDirectory } from "@architecture/notifications/application";
import {
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
} from "@architecture/notifications/domain";
import type { Kysely } from "kysely";

export class KyselyIamNotificationRecipientDirectoryAdapter extends NotificationRecipientDirectory {
  constructor(private readonly db: Kysely<IamDatabase>) {
    super();
  }

  async findUser(userId: string): Promise<NotificationRecipientEntity | null> {
    const row = await this.db
      .selectFrom("iam_users")
      .select(["id", "email"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!row) {
      return null;
    }
    const identifier = NotificationRecipientIdentifierValueObject.create(
      row.id,
    );
    if (!identifier.success) {
      throw new Error("Invalid IAM notification recipient identifier");
    }
    return NotificationRecipientEntity.create({
      identifier: identifier.value,
      email: row.email,
      phoneNumber: null,
    });
  }

  async listAdministratorIds(): Promise<string[]> {
    const rows = await this.db
      .selectFrom("iam_users")
      .select("id")
      .where("role", "=", "admin")
      .where("status", "=", "active")
      .execute();
    return rows.map((row) => row.id);
  }
}
