import type { IntegrationEvent } from "@architecture/messaging/domain";

type AccountFact =
  | {
      readonly type:
        | "mfa.activated"
        | "mfa.disabled"
        | "mfa.backup_codes.regenerated"
        | "mfa.backup_code.used"
        | "account.recovery.completed"
        | "account.deletion.cancelled";
      readonly userId: string;
    }
  | {
      readonly type: "account.deletion.requested";
      readonly userId: string;
      readonly scheduledFor: string;
    }
  | {
      readonly type: "account.export.generated" | "account.export.downloaded";
      readonly userId: string;
      readonly exportId: string;
    };

export type IamSecurityEventInput = (
  | AccountFact
  | {
      readonly type: "account.deletion.executed";
      readonly pseudonymousSubject: string;
    }
  | {
      readonly type: "security.config.published";
      readonly revisionId: string;
      readonly actorId: string;
      readonly version: number;
      readonly changedKeys: readonly string[];
      readonly justification: string;
    }
) & { readonly eventId: string; readonly occurredAt: Date };

/** IAM owns the fact; persistence supplies identity/time and appends atomically. */
export function createIamSecurityEvent(
  input: IamSecurityEventInput,
): IntegrationEvent {
  const envelope = {
    eventId: input.eventId,
    topic: input.type,
    version: 1,
    occurredAt: input.occurredAt,
  };
  if (input.type === "account.deletion.executed") {
    return {
      ...envelope,
      aggregateId: input.pseudonymousSubject,
      payload: { pseudonymousSubject: input.pseudonymousSubject },
      context: { actorType: "system" },
    };
  }
  if (input.type === "security.config.published") {
    return {
      ...envelope,
      aggregateId: input.revisionId,
      payload: {
        version: input.version,
        changedKeys: [...input.changedKeys],
        justification: input.justification,
      },
      context: {
        actorType: "administrator",
        actorId: input.actorId,
        subjectId: input.actorId,
      },
    };
  }
  const actorType = securityActorType(input.type);
  return {
    ...envelope,
    aggregateId: input.userId,
    payload: {
      userId: input.userId,
      ...(input.type === "account.deletion.requested"
        ? { scheduledFor: input.scheduledFor }
        : {}),
      ...(input.type === "account.export.generated" ||
      input.type === "account.export.downloaded"
        ? { exportId: input.exportId }
        : {}),
    },
    context: {
      actorType,
      ...(actorType === "user" ? { actorId: input.userId } : {}),
      subjectId: input.userId,
    },
  };
}

function securityActorType(
  type: IamSecurityEventInput["type"],
): "anonymous" | "system" | "user" {
  if (type === "account.recovery.completed") {
    return "anonymous";
  }
  return type === "account.export.generated" ? "system" : "user";
}
