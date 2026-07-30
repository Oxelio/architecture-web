import type { IntegrationEventHandler } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";
import {
  type NotificationChannelType,
  NotificationEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";

import {
  notificationPolicies,
  type NotificationPolicy,
} from "#application/policies/notification.policies";
import { NotificationRepository } from "#repositories/notification.repository";
import { NotificationRecipientDirectory } from "#repositories/notification-recipient-directory.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";

export class NotificationEventHandlerUseCase implements IntegrationEventHandler {
  readonly topics = Object.keys(notificationPolicies);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly directory: NotificationRecipientDirectory,
    private readonly deliveries: readonly NotificationDelivery[],
  ) {}

  async handle(event: IntegrationEvent): Promise<void> {
    const policy = notificationPolicies[event.topic];
    const subjectId =
      typeof event.payload["userId"] === "string"
        ? event.payload["userId"]
        : typeof event.context["subjectId"] === "string"
          ? event.context["subjectId"]
          : undefined;
    if (!policy || !subjectId) {
      return;
    }

    const recipient = await this.directory.findUser(subjectId);
    if (recipient) {
      await this.createForRecipient(event, recipient, policy, false);
    }
    if (policy.notifyAdministrators) {
      for (const administratorId of await this.directory.listAdministratorIds()) {
        const administrator = await this.directory.findUser(administratorId);
        if (administrator) {
          await this.createForRecipient(event, administrator, policy, true);
        }
      }
    }
  }

  private async createForRecipient(
    event: IntegrationEvent,
    recipient: {
      readonly userId: string;
      readonly email?: string;
      readonly phoneNumber?: string;
    },
    policy: NotificationPolicy,
    administrator: boolean,
  ): Promise<void> {
    const requested = administrator
      ? (policy.administratorChannels ?? [])
      : policy.userChannels;
    const destinations: Partial<
      Record<NotificationChannelType, string | undefined>
    > = {
      email: recipient.email,
      sms: recipient.phoneNumber,
      slack: administrator ? "security" : undefined,
    };
    const deliveries = [];
    for (const channel of requested) {
      const destination = destinations[channel];
      const enabled =
        policy.mandatory ||
        (await this.repository.isChannelEnabled(recipient.userId, channel));
      const available = this.deliveries.some(
        (delivery) => delivery.channel === channel,
      );
      if (destination && enabled && available) {
        deliveries.push({ channel, destination });
      }
    }
    const severity = NotificationSeverityValueObject.create(policy.severity);
    if (!severity.success) {
      throw new Error(`Unsupported notification severity: ${policy.severity}`);
    }
    await this.repository.create(
      NotificationEntity.create({
        recipientId: recipient.userId,
        sourceEventId: event.eventId,
        type: event.topic,
        severity: severity.value,
        title: policy.title,
        message: policy.message,
        ...(policy.actionUrl ? { actionUrl: policy.actionUrl } : {}),
        deliveries,
      }),
    );
  }
}
