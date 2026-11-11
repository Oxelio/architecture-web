import { randomUUID } from "node:crypto";

import type {
  AuditAcceptance,
  AuditAccountExporter,
} from "@architecture/audit/application";
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
    private readonly accountExporter: AuditAccountExporter,
    private readonly policies: PublishedConfigurationReader,
    private readonly acceptance: AuditAcceptance,
    private readonly origins: RecoveryOriginLimiter,
  ) {}
  async record(
    type: string,
    result: "success" | "denied" | "technical_failure",
    context: SecurityContext,
    metadata: Record<string, unknown> = {},
  ) {
    const id = randomUUID();
    try {
      const policy = await this.policies.readPublished(),
        occurredAt = new Date();
      await this.acceptance.accept({
        id,
        type,
        occurredAt,
        result,
        context,
        metadata,
        retentionDays: policy.values.audit.retentionDays,
      });
    } catch {
      console.error("Audit preparation failed; event lost", { eventId: id });
    }
  }
  countRecent(fingerprint: string, since: Date) {
    return this.origins.countRecent(fingerprint, since);
  }
  async exportFor(userId: string) {
    return (await this.accountExporter.exportFor(userId)).map((entry) => ({
      id: entry.id,
      type: entry.type,
      occurred_at: entry.occurredAt,
      result: entry.result,
      actor_type: entry.actorType,
    }));
  }
}
