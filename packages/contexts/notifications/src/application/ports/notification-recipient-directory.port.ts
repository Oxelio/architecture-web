import type { NotificationRecipientEntity } from "#domain/index";

export type AffectedUserDeliveryEligibility =
  "eligible" | "erased" | "unresolved";

export abstract class NotificationRecipientDirectory {
  abstract findUser(
    userId: string,
  ): Promise<NotificationRecipientEntity | null>;
  abstract listAdministratorIds(): Promise<string[]>;
  abstract isActiveAdministrator(userId: string): Promise<boolean>;
  abstract readAffectedUserDeliveryEligibility(
    userId: string,
  ): Promise<AffectedUserDeliveryEligibility>;
}
