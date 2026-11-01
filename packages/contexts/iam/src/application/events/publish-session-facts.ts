import type { OutboxWriter } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";

/** Redis effects already succeeded; publication loss must not report business failure. */
export async function publishSessionFacts(
  outbox: OutboxWriter,
  events: readonly IntegrationEvent[],
): Promise<void> {
  try {
    await outbox.append(events);
  } catch {
    console.error("Session fact acceptance failed; events lost", {
      eventIds: events.map((event) => event.eventId),
    });
  }
}
