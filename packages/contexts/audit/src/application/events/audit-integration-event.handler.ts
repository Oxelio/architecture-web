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
  "security.config.published",
  "account.recovery.completed",
  "mfa.activated",
  "mfa.disabled",
  "mfa.backup_codes.regenerated",
  "mfa.backup_code.used",
  "account.export.generated",
  "account.export.downloaded",
  "account.deletion.requested",
  "account.deletion.cancelled",
  "account.deletion.executed",
] as const;

export class AuditIntegrationEventHandler implements IntegrationEventHandler {
  readonly topics = IAM_AUDITED_TOPICS;

  constructor(
    private readonly audit: AuditRecorder,
    private readonly retention: { getRetentionDays(): Promise<number> },
  ) {}

  async handle(event: IntegrationEvent): Promise<void> {
    if (!(this.topics as readonly string[]).includes(event.topic)) {
      return;
    }
    const version = event.topic === "iam.session-started" ? 2 : 1;
    if (event.version !== version) {
      throw new Error("Unsupported audit event version");
    }
    validateAuditPayload(event);
    const actorType = auditActorType(event.context["actorType"]);
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
      retentionDays: await this.retention.getRetentionDays(),
    });
  }
}

function validateAuditPayload(event: IntegrationEvent): void {
  if (event.topic === "security.config.published") {
    if (
      !Number.isSafeInteger(event.payload["version"]) ||
      !Array.isArray(event.payload["changedKeys"]) ||
      !event.payload["changedKeys"].every(
        (key: unknown) => typeof key === "string",
      ) ||
      typeof event.payload["justification"] !== "string"
    ) {
      throw new Error("Invalid configuration event");
    }
  } else {
    const subject =
      event.payload[
        event.topic === "account.deletion.executed"
          ? "pseudonymousSubject"
          : "userId"
      ];
    if (typeof subject !== "string" || !subject.trim()) {
      throw new Error("Invalid audit event subject");
    }
  }
}

function auditActorType(
  value: unknown,
): "administrator" | "system" | "anonymous" | "user" {
  if (
    value === "administrator" ||
    value === "system" ||
    value === "anonymous"
  ) {
    return value;
  }
  return "user";
}
