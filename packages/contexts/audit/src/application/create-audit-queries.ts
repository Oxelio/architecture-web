import { Result } from "@architecture/foundation";
import { validate as isUuid } from "uuid";

import { redactAuditMetadata } from "#domain/audit-redaction.policy";
import type { AuditRepository } from "#repositories/audit.repository";

import type { AuditRecorder } from "./audit.contracts.js";
import {
  type AuditAccess,
  type AuditQueriesApplication,
  AuditQueryErrors,
  ownAuditEntry,
} from "./audit-query.contracts.js";

export interface AuditQueriesDependencies {
  readonly repository: AuditRepository;
  readonly access: AuditAccess;
  readonly recorder: AuditRecorder;
}

export function createAuditQueries(
  dependencies: AuditQueriesDependencies,
): AuditQueriesApplication {
  async function authorize(actorId: string, administrative: boolean) {
    const actor = await dependencies.access.resolveActor(actorId);
    if (!actor.active || (administrative && !actor.administrator)) {
      return Result.failure(AuditQueryErrors.unauthorized);
    }
    if (!actor.consultationEnabled) {
      return Result.failure(AuditQueryErrors.disabled);
    }
    return Result.success(actor);
  }
  function pagination(page: number, size: number) {
    if (!Number.isSafeInteger(page) || page < 1) {
      return AuditQueryErrors.invalidPage;
    }
    if (!Number.isSafeInteger(size) || size < 1 || size > 100) {
      return AuditQueryErrors.invalidPageSize;
    }
    return null;
  }
  async function record(
    actorId: string,
    administrative: boolean,
    retentionDays: number,
  ) {
    await dependencies.recorder.record({
      type: "security.audit.consulted",
      result: "success",
      context: {
        actorType: administrative ? "administrator" : "user",
        actorId,
        subjectId: actorId,
      },
      metadata: { scope: administrative ? "administrative" : "own" },
      retentionDays,
    });
  }
  return {
    listOwn: {
      async execute(input) {
        const authorization = await authorize(input.actorUserId, false);
        if (!authorization.success) {
          return authorization;
        }
        const page = input.page ?? 1,
          size = input.pageSize ?? 25;
        const error = pagination(page, size);
        if (error) {
          return Result.failure(error);
        }
        const rows = await dependencies.repository.listForSubject(
          input.actorUserId,
          page,
          size,
        );
        await record(
          input.actorUserId,
          false,
          authorization.value.retentionDays,
        );
        return Result.success(rows.map(ownAuditEntry));
      },
    },
    listAdministrative: {
      async execute(input) {
        const authorization = await authorize(input.actorUserId, true);
        if (!authorization.success) {
          return authorization;
        }
        const error = pagination(input.filters.page, input.filters.pageSize);
        if (error) {
          return Result.failure(error);
        }
        const { from, to } = input.filters;
        if (
          (input.filters.actorId && !isUuid(input.filters.actorId)) ||
          (input.filters.subjectId && !isUuid(input.filters.subjectId))
        ) {
          return Result.failure(AuditQueryErrors.invalidFilter);
        }
        if (
          (from && Number.isNaN(from.getTime())) ||
          (to && Number.isNaN(to.getTime())) ||
          (from && to && from > to)
        ) {
          return Result.failure(AuditQueryErrors.invalidFilter);
        }
        const rows = await dependencies.repository.query(input.filters);
        await record(
          input.actorUserId,
          true,
          authorization.value.retentionDays,
        );
        return Result.success(
          rows.map((entry) => ({
            ...entry,
            metadata: redactAuditMetadata(entry.metadata) as Record<
              string,
              unknown
            >,
          })),
        );
      },
    },
  };
}
