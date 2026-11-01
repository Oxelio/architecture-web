import { v4 as randomUUID } from "uuid";

import type { AuditEntryInput } from "#domain/audit-entry";
import { redactAuditMetadata } from "#domain/audit-redaction.policy";
import type { AuditRepository } from "#repositories/audit.repository";

import type { AuditPseudonymizer } from "../audit-pseudonymizer.js";
import { ownAuditEntry } from "../audit-query.contracts.js";

export class AuditApplication {
  constructor(
    private readonly repository: AuditRepository,
    private readonly pseudonymizer: AuditPseudonymizer,
  ) {}

  record(input: AuditEntryInput): Promise<void> {
    return this.repository.append({
      ...input,
      id: input.id ?? randomUUID(),
      actorReference: input.context.actorId
        ? this.pseudonymizer.reference(input.context.actorId)
        : null,
      subjectReference: input.context.subjectId
        ? this.pseudonymizer.reference(input.context.subjectId)
        : null,
      metadata: redactAuditMetadata(input.metadata ?? {}) as Record<
        string,
        unknown
      >,
    });
  }

  async exportFor(userId: string) {
    return (await this.repository.exportForSubject(userId)).map(ownAuditEntry);
  }

  purge(now = new Date()) {
    return this.repository.purgeExpired(now);
  }

  removeAccountReferences(reference: string) {
    return this.repository.pseudonymizeSubject(reference);
  }
}
