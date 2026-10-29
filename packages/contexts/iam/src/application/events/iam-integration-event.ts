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
  return {
    eventId: event.eventId,
    topic: event.type,
    version: sessionStarted ? 2 : 1,
    aggregateId: sessionStarted ? (userId as string) : event.aggregateId,
    occurredAt: event.occurredAt,
    payload: sessionStarted ? { userId } : event.payload,
    context: {
      actorType: actorId ? "administrator" : "user",
      ...(actorId ? { actorId } : userId ? { actorId: userId } : {}),
      ...(userId ? { subjectId: userId } : {}),
    },
  };
}
