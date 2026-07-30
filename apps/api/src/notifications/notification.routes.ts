import type { NotificationsApplication } from "@architecture/notifications/application";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";

const channels = ["email", "slack", "sms"] as const;

export function buildNotificationRoutes(
  notifications: NotificationsApplication,
) {
  return async (app: FastifyInstance) => {
    const { authenticate } = app as AuthenticatedFastifyInstance;
    app.addHook("preHandler", authenticate);

    app.get("/", async (request) => {
      const query = request.query as { page?: string; pageSize?: string };
      return {
        data: await notifications.listNotifications.execute(
          authenticatedUserId(request),
          numberOr(query.page, 1),
          numberOr(query.pageSize, 25),
        ),
      };
    });

    app.get("/unread-count", async (request) => ({
      data: {
        count: await notifications.unreadCount.execute(
          authenticatedUserId(request),
        ),
      },
    }));

    app.post("/:notificationId/read", async (request, reply) => {
      const { notificationId } = request.params as { notificationId: string };
      const updated = await notifications.markRead.execute(
        authenticatedUserId(request),
        notificationId,
      );
      return updated
        ? reply.status(204).send()
        : reply.status(404).send({ error: { code: "NOTIFICATION_NOT_FOUND" } });
    });

    app.post("/read-all", async (request, reply) => {
      await notifications.markAllRead.execute(authenticatedUserId(request));
      return reply.status(204).send();
    });

    app.get("/preferences", async (request) => ({
      data: await notifications.getPreferences.execute(
        authenticatedUserId(request),
      ),
    }));

    app.put("/preferences/:channel", async (request, reply) => {
      const { channel } = request.params as { channel: string };
      const { enabled } = request.body as { enabled?: unknown };
      if (
        !channels.includes(channel as (typeof channels)[number]) ||
        typeof enabled !== "boolean"
      ) {
        return reply
          .status(400)
          .send({ error: { code: "INVALID_NOTIFICATION_PREFERENCE" } });
      }
      await notifications.updatePreference.execute(
        authenticatedUserId(request),
        channel as (typeof channels)[number],
        enabled,
      );
      return reply.status(204).send();
    });
  };
}

function authenticatedUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error("An authenticated notification route has no user");
  }
  return userId;
}

function numberOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
