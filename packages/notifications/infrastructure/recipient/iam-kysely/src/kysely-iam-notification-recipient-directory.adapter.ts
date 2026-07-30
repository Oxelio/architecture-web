import type { IamDatabase } from "@architecture/iam-persistence-kysely";
import {
  type NotificationRecipient,
  NotificationRecipientDirectory,
} from "@architecture/notifications/application";
import type { Kysely } from "kysely";

export class KyselyIamNotificationRecipientDirectoryAdapter extends NotificationRecipientDirectory {
  constructor(private readonly db: Kysely<IamDatabase>) {
    super();
  }

  async findUser(userId: string): Promise<NotificationRecipient | null> {
    const row = await this.db
      .selectFrom("iam_users")
      .select(["id", "email"])
      .where("id", "=", userId)
      .executeTakeFirst();
    return row ? { userId: row.id, email: row.email } : null;
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
