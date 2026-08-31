import type { NotificationRecipientEntity } from "@architecture/notifications/domain";

export abstract class NotificationRecipientDirectory {
  abstract findUser(
    userId: string,
  ): Promise<NotificationRecipientEntity | null>;
  abstract listAdministratorIds(): Promise<string[]>;
}
