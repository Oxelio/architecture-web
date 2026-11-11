import { v4 as randomUUID } from "uuid";

import { redactAuditMetadata } from "#domain/audit-redaction.policy";
import type { AuditRepository } from "#repositories/audit.repository";

import type { AuditEventConsumer, AuditRetention } from "../audit.contracts.js";
import type { AuditPseudonymizer } from "../audit-pseudonymizer.js";
import {
  type AuditAccountExporter,
  ownAuditEntry,
} from "../audit-query.contracts.js";

export function createAuditEventConsumer(
  repository: AuditRepository,
  pseudonymizer: AuditPseudonymizer,
): AuditEventConsumer {
  return {
    record(input) {
      return repository.append({
        ...input,
        id: input.id ?? randomUUID(),
        actorReference: input.context.actorId
          ? pseudonymizer.reference(input.context.actorId)
          : null,
        subjectReference: input.context.subjectId
          ? pseudonymizer.reference(input.context.subjectId)
          : null,
        metadata: redactAuditMetadata(input.metadata ?? {}) as Record<
          string,
          unknown
        >,
      });
    },
    removeAccountReferences(reference) {
      return repository.pseudonymizeSubject(reference);
    },
  };
}

export function createAuditAccountExporter(
  repository: AuditRepository,
): AuditAccountExporter {
  return {
    async exportFor(userId) {
      return (await repository.exportForSubject(userId)).map(ownAuditEntry);
    },
  };
}

export function createAuditRetention(
  repository: AuditRepository,
): AuditRetention {
  return {
    purge(now = new Date()) {
      return repository.purgeExpired(now);
    },
  };
}
