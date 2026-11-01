import type { NotificationRecipientEntity } from "#domain/index";

export abstract class NotificationRecipientDirectory {
  abstract findUser(
    userId: string,
  ): Promise<NotificationRecipientEntity | null>;
  abstract listAdministratorIds(): Promise<string[]>;
  abstract isActiveAdministrator(userId: string): Promise<boolean>;
}
