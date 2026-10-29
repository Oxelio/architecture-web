import { randomUUID } from "node:crypto";

import type { OutboxWriter } from "@architecture/messaging/application";
export function appendIamSecurityEvent(
  outbox: OutboxWriter,
  type: string,
  userId: string,
  actorType: "user" | "system" | "anonymous" = "user",
  metadata: Record<string, unknown> = {},
) {
  return outbox.append([
    {
      eventId: randomUUID(),
      topic: type,
      version: 1,
      aggregateId: userId,
      occurredAt: new Date(),
      payload: { userId, ...metadata },
      context: {
        actorType,
        ...(actorType === "user" ? { actorId: userId } : {}),
        subjectId: userId,
      },
    },
  ]);
}
