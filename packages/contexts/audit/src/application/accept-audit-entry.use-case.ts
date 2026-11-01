import type {
  IntegrationEventHandler,
  OutboxWriter,
} from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";
import { v4 as randomUUID } from "uuid";

import type { AuditEntryInput } from "#domain/audit-entry";
import { redactAuditMetadata } from "#domain/audit-redaction.policy";
import { MAX_AUDIT_RETENTION_DAYS } from "#domain/audit-retention.policy";

import type { AuditRecorder } from "./audit.contracts.js";
import type { AuditPseudonymizer } from "./audit-pseudonymizer.js";

const TOPIC = "audit.entry-accepted";

/** Explicit loss policy: a failed durable append is reported, never a business rollback. */
export class AcceptAuditEntryUseCase implements AuditRecorder {
  constructor(
    private readonly outbox: OutboxWriter,
    private readonly pseudonymizer: AuditPseudonymizer,
    private readonly logger: {
      error(details: { eventId: string }, message: string): void;
    } = console,
  ) {}

  async record(input: AuditEntryInput): Promise<void> {
    const eventId = input.id ?? randomUUID();
    const { ipAddress, ...context } = input.context;
    const event: IntegrationEvent = {
      eventId,
      topic: TOPIC,
      version: 1,
      aggregateId: context.subjectId ?? context.actorId ?? eventId,
      occurredAt: input.occurredAt ?? new Date(),
      context: {
        ...context,
        ...(ipAddress
          ? { networkFingerprint: this.pseudonymizer.reference(ipAddress) }
          : {}),
      },
      payload: {
        type: input.type,
        result: input.result,
        metadata: redactAuditMetadata(input.metadata ?? {}),
        retentionDays: input.retentionDays,
      },
    };
    try {
      await this.outbox.append([event]);
    } catch {
      this.logger.error(
        { eventId },
        "Audit durable acceptance failed; event lost",
      );
    }
  }
}

export class AuditAcceptanceEventHandler implements IntegrationEventHandler {
  readonly topics = [TOPIC];
  constructor(private readonly audit: AuditRecorder) {}
  async handle(event: IntegrationEvent): Promise<void> {
    if (event.topic !== TOPIC) {
      return;
    }
    const { type, result, metadata, retentionDays } = event.payload;
    const actorType = event.context["actorType"];
    if (
      event.version !== 1 ||
      typeof type !== "string" ||
      !type.trim() ||
      (result !== "success" &&
        result !== "denied" &&
        result !== "technical_failure") ||
      (actorType !== "user" &&
        actorType !== "administrator" &&
        actorType !== "anonymous" &&
        actorType !== "system") ||
      typeof retentionDays !== "number" ||
      !Number.isSafeInteger(retentionDays) ||
      retentionDays < 1 ||
      retentionDays > MAX_AUDIT_RETENTION_DAYS ||
      metadata === null ||
      typeof metadata !== "object" ||
      Array.isArray(metadata)
    ) {
      throw new Error("Invalid accepted Audit event contract");
    }
    const context: Record<string, string> = {};
    for (const key of [
      "actorId",
      "subjectId",
      "correlationId",
      "client",
      "networkFingerprint",
    ] as const) {
      const value = event.context[key];
      if (value !== undefined) {
        if (typeof value !== "string") {
          throw new Error("Invalid accepted Audit context");
        }
        context[key] = value;
      }
    }
    await this.audit.record({
      id: event.eventId,
      occurredAt: event.occurredAt,
      type,
      result,
      context: { actorType, ...context },
      metadata: metadata as Record<string, unknown>,
      retentionDays,
    });
  }
}
