import type { IntegrationEventHandler } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";

import {
  notificationPolicies,
  type NotificationPolicy,
} from "#application/policies/notification.policies";
import type { NotificationRecipientEntity } from "#domain/entities/notification-recipient.entity";
import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "#domain/index";
import type { NotificationRepository } from "#repositories/notification.repository";
import type { NotificationPreferenceRepository } from "#repositories/notification-preference.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";
import type { NotificationRecipientDirectory } from "#services/notification-recipient-directory.service";

export class NotificationEventHandlerUseCase implements IntegrationEventHandler {
  readonly topics = Object.keys(notificationPolicies);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly directory: NotificationRecipientDirectory,
    private readonly deliveries: readonly NotificationDelivery[],
  ) {}

  async handle(event: IntegrationEvent): Promise<void> {
    const policy = notificationPolicies[event.topic];
    if (!policy) {
      return;
    }
    if (event.version !== (event.topic === "iam.session-started" ? 2 : 1)) {
      throw new Error("Unsupported notification event version");
    }
    const subjectId =
      typeof event.payload["userId"] === "string"
        ? event.payload["userId"]
        : typeof event.context["subjectId"] === "string"
          ? event.context["subjectId"]
          : undefined;
    if (!subjectId?.trim()) {
      throw new Error("Invalid notification event subject");
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
    recipient: NotificationRecipientEntity,
    policy: NotificationPolicy,
    administrator: boolean,
  ): Promise<void> {
    const requested = administrator
      ? (policy.administratorChannels ?? [])
      : policy.userChannels;
    const deliveries = [];
    for (const channel of requested) {
      const destination =
        channel === "slack" && administrator
          ? "security"
          : recipient.destinationFor(channel);
      const enabled =
        policy.mandatory ||
        (await this.preferences.find(recipient.userId, channel))?.enabled !==
          false;
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
