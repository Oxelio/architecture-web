import type {
  IntegrationEvent,
  IntegrationEventHandler,
} from "@architecture/messaging";

export type NotificationSeverity = "information" | "warning" | "critical";
export type NotificationChannelType = "email" | "slack" | "sms";

export interface NotificationView {
  readonly id: string;
  readonly type: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string | null;
  readonly createdAt: Date;
  readonly readAt: Date | null;
}

export interface NotificationPreference {
  readonly channel: NotificationChannelType;
  readonly enabled: boolean;
}

export interface NotificationRecipient {
  readonly userId: string;
  readonly email?: string;
  readonly phoneNumber?: string;
}

export interface NotificationDraft {
  readonly recipientId: string;
  readonly sourceEventId: string;
  readonly type: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionUrl?: string;
  readonly deliveries: readonly {
    readonly channel: NotificationChannelType;
    readonly destination: string;
  }[];
}

export interface PendingDelivery {
  readonly id: string;
  readonly notificationId: string;
  readonly channel: NotificationChannelType;
  readonly destination: string;
  readonly title: string;
  readonly message: string;
  readonly attempts: number;
}

export abstract class NotificationRepository {
  abstract create(draft: NotificationDraft): Promise<void>;
  abstract list(
    recipientId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationView[]>;
  abstract unreadCount(recipientId: string): Promise<number>;
  abstract markRead(
    recipientId: string,
    notificationId: string,
  ): Promise<boolean>;
  abstract markAllRead(recipientId: string): Promise<void>;
  abstract preferences(recipientId: string): Promise<NotificationPreference[]>;
  abstract setPreference(
    recipientId: string,
    channel: NotificationChannelType,
    enabled: boolean,
  ): Promise<void>;
  abstract isChannelEnabled(
    recipientId: string,
    channel: NotificationChannelType,
  ): Promise<boolean>;
  abstract claimDeliveries(limit: number): Promise<PendingDelivery[]>;
  abstract deliverySucceeded(id: string): Promise<void>;
  abstract deliveryFailed(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void>;
}

export abstract class NotificationRecipientDirectory {
  abstract findUser(userId: string): Promise<NotificationRecipient | null>;
  abstract listAdministratorIds(): Promise<string[]>;
}

export interface NotificationDelivery {
  readonly channel: NotificationChannelType;
  send(delivery: PendingDelivery): Promise<void>;
}

interface NotificationPolicy {
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionUrl?: string;
  readonly notifyAdministrators?: boolean;
  readonly userChannels: readonly NotificationChannelType[];
  readonly administratorChannels?: readonly NotificationChannelType[];
  readonly mandatory?: boolean;
}

const policies: Readonly<Record<string, NotificationPolicy>> = {
  "iam.user-registered": {
    severity: "information",
    title: "Account created",
    message: "Your account has been created.",
    actionUrl: "/profile",
    userChannels: ["email"],
  },
  "iam.user-email-changed": {
    severity: "critical",
    title: "Email address changed",
    message: "The sign-in email address for your account was changed.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "iam.user-password-changed": {
    severity: "critical",
    title: "Password changed",
    message: "The password for your account was changed.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "iam.user-role-changed": {
    severity: "warning",
    title: "Account role changed",
    message: "The permissions associated with your account were changed.",
    actionUrl: "/profile",
    notifyAdministrators: true,
    userChannels: ["email"],
    administratorChannels: ["slack"],
    mandatory: true,
  },
  "iam.user-suspended": {
    severity: "critical",
    title: "Account suspended",
    message: "Your account has been suspended by an administrator.",
    notifyAdministrators: true,
    userChannels: ["email"],
    administratorChannels: ["slack"],
    mandatory: true,
  },
  "iam.user-activated": {
    severity: "information",
    title: "Account activated",
    message: "Your account has been activated.",
    actionUrl: "/profile",
    userChannels: ["email"],
  },
  "iam.user-email-verified": {
    severity: "information",
    title: "Email address verified",
    message: "Your email address has been verified.",
    actionUrl: "/profile",
    userChannels: [],
  },
  "iam.session-started": {
    severity: "warning",
    title: "New session",
    message: "A new session was opened for your account.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "security.suspicious-activity-detected": {
    severity: "critical",
    title: "Suspicious activity detected",
    message: "Suspicious activity was detected on your account.",
    actionUrl: "/profile",
    notifyAdministrators: true,
    userChannels: ["email", "sms"],
    administratorChannels: ["slack"],
    mandatory: true,
  },
  "account.recovery.completed": {
    severity: "critical",
    title: "Account recovery completed",
    message: "Your account password was reset through account recovery.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "account.deletion.requested": {
    severity: "critical",
    title: "Account deletion requested",
    message: "A request to delete your account was recorded.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "account.deletion.cancelled": {
    severity: "information",
    title: "Account deletion cancelled",
    message: "The request to delete your account was cancelled.",
    actionUrl: "/profile",
    userChannels: ["email"],
  },
  "mfa.activated": {
    severity: "information",
    title: "Multifactor authentication enabled",
    message: "Multifactor authentication was enabled for your account.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "mfa.disabled": {
    severity: "critical",
    title: "Multifactor authentication disabled",
    message: "Multifactor authentication was disabled for your account.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "mfa.backup_codes.regenerated": {
    severity: "warning",
    title: "Backup codes regenerated",
    message: "New multifactor authentication backup codes were generated.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
  "mfa.backup_code.used": {
    severity: "warning",
    title: "Backup code used",
    message: "A multifactor authentication backup code was used.",
    actionUrl: "/profile",
    userChannels: ["email"],
    mandatory: true,
  },
};

export class NotificationApplication implements IntegrationEventHandler {
  readonly topics = Object.keys(policies);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly directory: NotificationRecipientDirectory,
    private readonly deliveries: readonly NotificationDelivery[] = [],
  ) {}

  async handle(event: IntegrationEvent): Promise<void> {
    const policy = policies[event.topic];
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

  list(userId: string, page: number, pageSize: number) {
    return this.repository.list(userId, page, pageSize);
  }

  unreadCount(userId: string) {
    return this.repository.unreadCount(userId);
  }

  markRead(userId: string, notificationId: string) {
    return this.repository.markRead(userId, notificationId);
  }

  markAllRead(userId: string) {
    return this.repository.markAllRead(userId);
  }

  preferences(userId: string) {
    return this.repository.preferences(userId);
  }

  setPreference(
    userId: string,
    channel: NotificationChannelType,
    enabled: boolean,
  ) {
    return this.repository.setPreference(userId, channel, enabled);
  }

  async deliverPending(limit = 50): Promise<number> {
    const pending = await this.repository.claimDeliveries(limit);
    for (const delivery of pending) {
      const adapter = this.deliveries.find(
        (candidate) => candidate.channel === delivery.channel,
      );
      try {
        if (!adapter) {
          throw new Error(`No adapter for ${delivery.channel}`);
        }
        await adapter.send(delivery);
        await this.repository.deliverySucceeded(delivery.id);
      } catch (error) {
        await this.repository.deliveryFailed(
          delivery.id,
          delivery.attempts + 1,
          error,
        );
      }
    }
    return pending.length;
  }

  private async createForRecipient(
    event: IntegrationEvent,
    recipient: NotificationRecipient,
    policy: NotificationPolicy,
    administrator: boolean,
  ): Promise<void> {
    const requested = administrator
      ? (policy.administratorChannels ?? [])
      : policy.userChannels;
    const channelDestinations: Partial<
      Record<NotificationChannelType, string | undefined>
    > = {
      email: recipient.email,
      sms: recipient.phoneNumber,
      slack: administrator ? "security" : undefined,
    };
    const deliveries = [];
    for (const channel of requested) {
      const destination = channelDestinations[channel];
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
    await this.repository.create({
      recipientId: recipient.userId,
      sourceEventId: event.eventId,
      type: event.topic,
      severity: policy.severity,
      title: policy.title,
      message: policy.message,
      ...(policy.actionUrl ? { actionUrl: policy.actionUrl } : {}),
      deliveries,
    });
  }
}
