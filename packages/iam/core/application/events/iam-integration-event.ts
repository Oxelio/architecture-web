import type { DomainEvent } from "@architecture/foundation";
import type { IntegrationEvent } from "@architecture/messaging";

export function toIamIntegrationEvent(event: DomainEvent): IntegrationEvent {
  const actorId =
    typeof event.payload["actorId"] === "string"
      ? event.payload["actorId"]
      : undefined;
  const userId =
    typeof event.payload["userId"] === "string"
      ? event.payload["userId"]
      : undefined;
  return {
    eventId: event.eventId,
    topic: event.type,
    version: 1,
    aggregateId: event.aggregateId,
    occurredAt: event.occurredAt,
    payload: event.payload,
    context: {
      actorType: actorId ? "administrator" : "user",
      ...(actorId ? { actorId } : userId ? { actorId: userId } : {}),
      ...(userId ? { subjectId: userId } : {}),
    },
  };
}
