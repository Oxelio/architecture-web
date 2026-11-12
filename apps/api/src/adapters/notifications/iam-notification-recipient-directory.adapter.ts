import type {
  AccountRecipientReader,
  AffectedUserDeliveryEligibilityReader,
} from "@architecture/iam/application";
import { NotificationRecipientDirectory } from "@architecture/notifications/application";
import {
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
} from "@architecture/notifications/domain";

export class IamNotificationRecipientDirectoryAdapter extends NotificationRecipientDirectory {
  constructor(
    private readonly recipients: AccountRecipientReader,
    private readonly eligibility: AffectedUserDeliveryEligibilityReader,
  ) {
    super();
  }

  readAffectedUserDeliveryEligibility(userId: string) {
    return this.eligibility.readAffectedUserDeliveryEligibility(userId);
  }

  async findUser(userId: string): Promise<NotificationRecipientEntity | null> {
    const recipient = await this.recipients.findRecipientContact(userId);
    if (!recipient) {
      return null;
    }
    const identifier = NotificationRecipientIdentifierValueObject.create(
      recipient.id,
    );
    if (!identifier.success) {
      throw new Error("Invalid IAM notification recipient identifier");
    }
    return NotificationRecipientEntity.create({
      identifier: identifier.value,
      email: recipient.email,
      phoneNumber: null,
    });
  }

  listAdministratorIds(): Promise<string[]> {
    return this.recipients.listActiveAdministratorIds();
  }

  isActiveAdministrator(userId: string): Promise<boolean> {
    return this.recipients.isActiveAdministrator(userId);
  }
}
