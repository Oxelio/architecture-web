import { createHash, randomUUID } from "node:crypto";

import type { IntegrationEventHandler } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";

export type AuditResult = "success" | "denied" | "technical_failure";
export type AuditActorType = "user" | "administrator" | "system" | "anonymous";

export interface AuditContext {
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly correlationId?: string;
  readonly ipAddress?: string;
  readonly client?: string;
}

export interface AuditEntryInput {
  readonly id?: string;
  readonly type: string;
  readonly occurredAt?: Date;
  readonly result: AuditResult;
  readonly context: AuditContext;
  readonly metadata?: Record<string, unknown>;
  readonly retentionDays: number;
}

export interface AuditQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: string;
  readonly result?: string;
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly correlationId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface AuditEntry {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: Date;
  readonly result: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly subjectId: string | null;
  readonly correlationId: string | null;
  readonly client: string | null;
  readonly metadata: Record<string, unknown>;
}

export abstract class AuditRepository {
  abstract append(
    entry: AuditEntryInput & { readonly id: string },
  ): Promise<void>;
  abstract listForSubject(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<AuditEntry[]>;
  abstract query(filters: AuditQuery): Promise<AuditEntry[]>;
  abstract exportForSubject(userId: string): Promise<AuditEntry[]>;
  abstract pseudonymizeSubject(
    userId: string,
    reference: string,
  ): Promise<void>;
  abstract purgeExpired(now: Date): Promise<number>;
  abstract countRecentByNetworkFingerprint(
    type: string,
    fingerprint: string,
    since: Date,
  ): Promise<number>;
}

const sensitiveKey = /(password|token|secret|cookie|authorization|code)/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? "[REDACTED]" : redact(item),
      ]),
    );
  }
  return value;
}

export class AuditApplication {
  constructor(private readonly repository: AuditRepository) {}

  record(input: AuditEntryInput): Promise<void> {
    return this.repository.append({
      ...input,
      id: input.id ?? randomUUID(),
      metadata: redact(input.metadata ?? {}) as Record<string, unknown>,
    });
  }

  listOwn(userId: string, page: number, pageSize: number) {
    return this.repository.listForSubject(userId, page, pageSize);
  }

  list(filters: AuditQuery) {
    return this.repository.query(filters);
  }

  exportFor(userId: string) {
    return this.repository.exportForSubject(userId);
  }

  purge(now = new Date()) {
    return this.repository.purgeExpired(now);
  }

  pseudonymize(userId: string) {
    const reference = createHash("sha256").update(userId).digest("hex");
    return this.repository.pseudonymizeSubject(userId, reference);
  }

  countRecentByNetworkFingerprint(
    type: string,
    fingerprint: string,
    since: Date,
  ) {
    return this.repository.countRecentByNetworkFingerprint(
      type,
      fingerprint,
      since,
    );
  }
}

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
    private readonly audit: AuditApplication,
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
