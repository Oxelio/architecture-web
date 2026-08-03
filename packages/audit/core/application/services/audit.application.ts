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
