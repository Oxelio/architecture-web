export interface NotificationRecipient {
  readonly userId: string;
  readonly email?: string;
  readonly phoneNumber?: string;
}

export abstract class NotificationRecipientDirectory {
  abstract findUser(userId: string): Promise<NotificationRecipient | null>;
  abstract listAdministratorIds(): Promise<string[]>;
}
