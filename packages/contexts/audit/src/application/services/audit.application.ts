import { createHash, randomUUID } from "node:crypto";

import type { AuditEntryInput } from "#domain/audit-entry";
import { redactAuditMetadata } from "#domain/audit-redaction.policy";
import type { AuditRepository } from "#repositories/audit.repository";

import type { AuditQuery } from "../audit.contracts.js";

export class AuditApplication {
  constructor(private readonly repository: AuditRepository) {}

  record(input: AuditEntryInput): Promise<void> {
    return this.repository.append({
      ...input,
      id: input.id ?? randomUUID(),
      metadata: redactAuditMetadata(input.metadata ?? {}) as Record<
        string,
        unknown
      >,
    });
  }

  async listOwn(userId: string, page: number, pageSize: number) {
    return (await this.repository.listForSubject(userId, page, pageSize)).map(
      safeAuditEntry,
    );
  }

  async list(filters: AuditQuery) {
    return (await this.repository.query(filters)).map(safeAuditEntry);
  }

  async exportFor(userId: string) {
    return (await this.repository.exportForSubject(userId)).map(safeAuditEntry);
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
function safeAuditEntry(entry: import("../audit.contracts.js").AuditEntry) {
  return {
    ...entry,
    metadata: redactAuditMetadata(entry.metadata) as Record<string, unknown>,
  };
}
