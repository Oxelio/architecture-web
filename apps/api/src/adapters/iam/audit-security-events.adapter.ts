import { randomUUID } from "node:crypto";

import type { AuditApplication } from "@architecture/audit/application";
import type {
  AccountAuditData,
  PublishedConfigurationReader,
  RecoveryOriginLimiter,
  SecurityContext,
  SecurityEventRecorder,
} from "@architecture/iam/application";
export class AuditSecurityEventsAdapter
  implements SecurityEventRecorder, RecoveryOriginLimiter, AccountAuditData
{
  constructor(
    private readonly audit: AuditApplication,
    private readonly policies: PublishedConfigurationReader,
  ) {}
  async record(
    type: string,
    result: "success" | "denied" | "technical_failure",
    context: SecurityContext,
    metadata: Record<string, unknown> = {},
  ) {
    const policy = await this.policies.readPublished(),
      occurredAt = new Date();
    await this.audit.record({
      id: randomUUID(),
      type,
      occurredAt,
      result,
      context,
      metadata,
      retentionDays: policy.values.audit.retentionDays,
    });
  }
  countRecent(fingerprint: string, since: Date) {
    return this.audit.countRecentByNetworkFingerprint(
      "account.recovery.requested",
      fingerprint,
      since,
    );
  }
  async exportFor(userId: string) {
    return (await this.audit.exportFor(userId)).map((entry) => ({
      id: entry.id,
      type: entry.type,
      occurred_at: entry.occurredAt,
      result: entry.result,
      actor_type: entry.actorType,
      actor_id: entry.actorId,
      subject_id: entry.subjectId,
      correlation_id: entry.correlationId,
      client: entry.client,
      metadata: entry.metadata,
    }));
  }
  pseudonymize(userId: string) {
    return this.audit.pseudonymize(userId);
  }
}
