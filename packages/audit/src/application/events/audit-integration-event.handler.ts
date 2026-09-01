import type { IntegrationEventHandler } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";

import type { AuditRecorder } from "../audit.contracts.js";

export const IAM_AUDITED_TOPICS = [
  "iam.user-registered",
  "iam.user-email-changed",
  "iam.user-password-changed",
  "iam.user-role-changed",
  "iam.user-suspended",
  "iam.user-activated",
  "iam.user-email-verified",
  "iam.session-started",
] as const;

export class AuditIntegrationEventHandler implements IntegrationEventHandler {
  readonly topics = IAM_AUDITED_TOPICS;

  constructor(
    private readonly audit: AuditRecorder,
    private readonly retentionDays = 365,
  ) {}

  handle(event: IntegrationEvent): Promise<void> {
    const actorType =
      event.context["actorType"] === "administrator" ? "administrator" : "user";
    return this.audit.record({
      id: event.eventId,
      type: event.topic,
      occurredAt: event.occurredAt,
      result: "success",
      context: {
        actorType,
        ...(typeof event.context["actorId"] === "string"
          ? { actorId: event.context["actorId"] }
          : {}),
        ...(typeof event.context["subjectId"] === "string"
          ? { subjectId: event.context["subjectId"] }
          : {}),
      },
      metadata: event.payload,
      retentionDays: this.retentionDays,
    });
  }
}
