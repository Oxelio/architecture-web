import type { IntegrationEvent } from "@architecture/messaging/domain";
import { v5 as uuid } from "uuid";

export type AccountRevocationReason =
  | "password_replaced"
  | "recovery_password_replaced"
  | "login_identity_replaced"
  | "mfa_activated"
  | "mfa_deactivated"
  | "backup_codes_regenerated"
  | "account_suspended"
  | "account_deletion_requested";

export interface DelegatedRevocationActor {
  readonly actorType: "user" | "administrator" | "anonymous";
  readonly actorId?: string;
}

export interface AccountDelegatedInvalidation {
  readonly accountId: string;
  readonly reason: AccountRevocationReason | "user_revocation";
  readonly actor: DelegatedRevocationActor;
}

interface DelegatedFactContext {
  readonly userId: string;
  readonly operationId: string;
  readonly occurredAt: Date;
  readonly actor: DelegatedRevocationActor;
}

export type DelegatedRevocationFact = DelegatedFactContext & {
  readonly reason:
    | AccountRevocationReason
    | "client_disabled"
    | "client_policy_changed"
    | "user_revocation"
    | "required_permission_withdrawn";
  readonly affectedGrantCount: number;
  readonly clientId?: string;
  readonly resourceId?: string;
  readonly grantId?: string;
};

export type DelegatedWithdrawalFact = DelegatedFactContext & {
  readonly clientId: string;
  readonly resourceId: string;
  readonly grantId: string;
  readonly permissions: readonly string[];
};

const factNamespace = uuid(
  "architecture-web/iam/delegated-revocation/v1",
  uuid.URL,
);

export function createDelegatedRevocationFact(
  input: DelegatedRevocationFact,
): IntegrationEvent {
  const {
    userId,
    operationId,
    occurredAt,
    actor,
    reason,
    affectedGrantCount,
    clientId,
    resourceId,
    grantId,
  } = input;
  if (!Number.isSafeInteger(affectedGrantCount) || affectedGrantCount < 1) {
    throw new Error("A revocation fact requires an actual affected grant");
  }
  return {
    eventId: uuid(`revoke:${operationId}:${userId}`, factNamespace),
    topic: "iam.delegated-grants-revoked",
    version: 1,
    aggregateId: userId,
    occurredAt,
    payload: {
      userId,
      operationId,
      reason,
      affectedGrantCount,
      ...(clientId === undefined ? {} : { clientId }),
      ...(resourceId === undefined ? {} : { resourceId }),
      ...(grantId === undefined ? {} : { grantId }),
    },
    context: delegatedActorContext(actor, userId),
  };
}

export function createDelegatedWithdrawalFact(
  input: DelegatedWithdrawalFact,
): IntegrationEvent {
  const {
    userId,
    operationId,
    occurredAt,
    actor,
    grantId,
    clientId,
    resourceId,
    permissions,
  } = input;
  return {
    eventId: uuid(`withdraw:${operationId}:${grantId}`, factNamespace),
    topic: "iam.delegated-permission-withdrawn",
    version: 1,
    aggregateId: grantId,
    occurredAt,
    payload: {
      userId,
      operationId,
      grantId,
      clientId,
      resourceId,
      permissions: [...permissions],
    },
    context: delegatedActorContext(actor, userId),
  };
}

function delegatedActorContext(
  { actorType, actorId }: DelegatedRevocationActor,
  subjectId: string,
) {
  return {
    actorType,
    subjectId,
    ...(actorId === undefined ? {} : { actorId }),
  };
}
