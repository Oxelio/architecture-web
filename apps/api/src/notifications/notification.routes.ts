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

    app.get("/", async (request, reply) => {
      const query = request.query as { page?: string; pageSize?: string };
      const result = await notifications.listNotifications.execute({
        actorUserId: authenticatedUserId(request),
        page: numberFrom(query.page, 1),
        pageSize: numberFrom(query.pageSize, 25),
      });
      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }
      return {
        data: result.value,
      };
    });

    app.get("/unread-count", async (request) => {
      const result = await notifications.unreadCount.execute({
        actorUserId: authenticatedUserId(request),
      });
      return { data: { count: successfulValue(result) } };
    });

    app.post("/:notificationId/read", async (request, reply) => {
      const { notificationId } = request.params as { notificationId: string };
      const result = await notifications.markRead.execute({
        actorUserId: authenticatedUserId(request),
        notificationId,
      });
      return result.success
        ? reply.status(204).send()
        : reply
            .status(result.error.code === "notification.invalid_id" ? 400 : 404)
            .send({ error: result.error });
    });

    app.post("/read-all", async (request, reply) => {
      const result = await notifications.markAllRead.execute({
        actorUserId: authenticatedUserId(request),
      });
      successfulValue(result);
      return reply.status(204).send();
    });

    app.get("/preferences", async (request) => {
      const result = await notifications.getPreferences.execute({
        actorUserId: authenticatedUserId(request),
      });
      return { data: successfulValue(result) };
    });

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
      const result = await notifications.updatePreference.execute({
        actorUserId: authenticatedUserId(request),
        channel: channel as (typeof channels)[number],
        enabled,
      });
      successfulValue(result);
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

function numberFrom(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : Number(value);
}

function successfulValue<T>(
  result:
    | { readonly success: true; readonly value: T }
    | { readonly success: false; readonly error: unknown },
): T {
  if (!result.success) {
    throw new Error("An infallible notification use case failed");
  }
  return result.value;
}
