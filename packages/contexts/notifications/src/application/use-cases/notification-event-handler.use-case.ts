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
    const subjectId = notificationSubject(event);
    if (!subjectId?.trim()) {
      throw new Error("Invalid notification event subject");
    }

    if (await this.repository.hasConsumedEvent(event.eventId)) {
      return;
    }
    const roles = new Map<string, { user: boolean; administrator: boolean }>([
      [subjectId, { user: true, administrator: false }],
    ]);
    if (policy.notifyAdministrators) {
      for (const administratorId of await this.directory.listAdministratorIds()) {
        roles.set(administratorId, {
          user: administratorId === subjectId,
          administrator: true,
        });
      }
    }
    const notifications: NotificationEntity[] = [];
    for (const [userId, role] of roles) {
      const recipient = await this.directory.findUser(userId);
      if (recipient) {
        notifications.push(
          await this.buildForRecipient(event, recipient, policy, role),
        );
      }
    }
    await this.repository.createForEvent(event.eventId, notifications);
  }

  private async buildForRecipient(
    event: IntegrationEvent,
    recipient: NotificationRecipientEntity,
    policy: NotificationPolicy,
    role: { user: boolean; administrator: boolean },
  ): Promise<NotificationEntity> {
    const requested = new Set([
      ...(role.user ? policy.userChannels : []),
      ...(role.administrator ? (policy.administratorChannels ?? []) : []),
    ]);
    const deliveries = [];
    for (const channel of requested) {
      const destination =
        channel === "slack" &&
        role.administrator &&
        policy.administratorChannels?.includes(channel)
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
    return NotificationEntity.create({
      recipientId: recipient.userId,
      sourceEventId: event.eventId,
      type: event.topic,
      severity: severity.value,
      title: policy.title,
      message: policy.message,
      ...(policy.actionUrl ? { actionUrl: policy.actionUrl } : {}),
      deliveries,
    });
  }
}

function notificationSubject(event: IntegrationEvent): string | undefined {
  if (typeof event.payload["userId"] === "string") {
    return event.payload["userId"];
  }
  return typeof event.context["subjectId"] === "string"
    ? event.context["subjectId"]
    : undefined;
}
