import type { DomainEvent } from "@architecture/foundation";
import type { IntegrationEvent } from "@architecture/messaging/domain";

export function toIamIntegrationEvent(event: DomainEvent): IntegrationEvent {
  const actorId =
    typeof event.payload["actorId"] === "string"
      ? event.payload["actorId"]
      : undefined;
  const userId =
    typeof event.payload["userId"] === "string"
      ? event.payload["userId"]
      : undefined;
  // Session identifiers are currently bearer credentials. Cross-context
  // consumers need the account fact, never the session authentication secret.
  const sessionStarted = event.type === "iam.session-started";
  if (sessionStarted && !userId) {
    throw new Error("Session-started events require an account identifier");
  }
  if (!userId) {
    throw new Error("IAM domain facts require an account identifier");
  }
  let payload: Record<string, unknown>;
  switch (event.type) {
    case "iam.session-started":
    case "iam.user-registered":
    case "iam.user-password-changed":
      payload = { userId };
      break;
    case "iam.user-email-changed":
    case "iam.user-email-verified":
      if (typeof event.payload["kind"] !== "string") {
        throw new Error("Missing identity kind");
      }
      payload = { userId, kind: event.payload["kind"] };
      break;
    case "iam.user-role-changed":
      if (typeof event.payload["role"] !== "string") {
        throw new Error("Missing account role");
      }
      payload = {
        userId,
        role: event.payload["role"],
        ...(actorId ? { actorId } : {}),
      };
      break;
    case "iam.user-suspended":
    case "iam.user-activated":
      payload = { userId, ...(actorId ? { actorId } : {}) };
      break;
    default:
      throw new Error("Unsupported IAM domain event");
  }
  return {
    eventId: event.eventId,
    topic: event.type,
    version: sessionStarted ? 2 : 1,
    aggregateId: sessionStarted ? (userId as string) : event.aggregateId,
    occurredAt: event.occurredAt,
    payload,
    context: {
      actorType: actorId ? "administrator" : "user",
      ...(actorId ? { actorId } : userId ? { actorId: userId } : {}),
      ...(userId ? { subjectId: userId } : {}),
    },
  };
}
