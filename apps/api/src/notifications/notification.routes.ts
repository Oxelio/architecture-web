import type { NotificationsApplication } from "@architecture/notifications/application";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AuthenticatedFastifyInstance } from "#app/auth";

const Channel = Type.Union([
  Type.Literal("email"),
  Type.Literal("slack"),
  Type.Literal("sms"),
]);
const ErrorResponse = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.Optional(Type.String()),
  }),
});
const PageQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
const NotificationParams = Type.Object({
  notificationId: Type.String({ minLength: 1 }),
});
const PreferenceParams = Type.Object({ channel: Channel });
const PreferenceBody = Type.Object(
  { enabled: Type.Boolean() },
  { additionalProperties: false },
);
const NotificationItem = Type.Object({
  id: Type.String(),
  type: Type.String(),
  severity: Type.Union([
    Type.Literal("information"),
    Type.Literal("warning"),
    Type.Literal("critical"),
  ]),
  title: Type.String(),
  message: Type.String(),
  action: Type.Union([Type.Literal("view_account"), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
  readAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export function buildNotificationRoutes(
  notifications: NotificationsApplication,
) {
  return async (app: FastifyInstance) => {
    const { authenticate } = app as AuthenticatedFastifyInstance;
    app.addHook("preHandler", authenticate);
    app.get<{ Querystring: Static<typeof PageQuery> }>(
      "/",
      {
        schema: {
          querystring: PageQuery,
          response: {
            200: Type.Object({ data: Type.Array(NotificationItem) }),
            400: ErrorResponse,
          },
        },
      },
      async (request, reply) => {
        const result = await notifications.listNotifications.execute({
          actorUserId: authenticatedUserId(request),
          ...request.query,
        });
        return result.success
          ? reply.send({ data: result.value })
          : reply.status(400).send({ error: result.error });
      },
    );
    app.get(
      "/unread-count",
      {
        schema: {
          response: {
            200: Type.Object({
              data: Type.Object({ count: Type.Integer({ minimum: 0 }) }),
            }),
          },
        },
      },
      async (request) => {
        const result = await notifications.unreadCount.execute({
          actorUserId: authenticatedUserId(request),
        });
        return { data: { count: successfulValue(result) } };
      },
    );
    app.post<{ Params: Static<typeof NotificationParams> }>(
      "/:notificationId/read",
      {
        schema: {
          params: NotificationParams,
          response: {
            204: Type.Null(),
            400: ErrorResponse,
            404: ErrorResponse,
          },
        },
      },
      async (request, reply) => {
        const result = await notifications.markRead.execute({
          actorUserId: authenticatedUserId(request),
          notificationId: request.params.notificationId,
        });
        if (result.success) {
          return reply.status(204).send();
        }
        return reply
          .status(result.error.code === "notification.invalid_id" ? 400 : 404)
          .send({ error: result.error });
      },
    );
    app.post(
      "/read-all",
      { schema: { response: { 204: Type.Null() } } },
      async (request, reply) => {
        successfulValue(
          await notifications.markAllRead.execute({
            actorUserId: authenticatedUserId(request),
          }),
        );
        return reply.status(204).send();
      },
    );
    app.get(
      "/preferences",
      {
        schema: {
          response: {
            200: Type.Object({
              data: Type.Array(
                Type.Object({ channel: Channel, enabled: Type.Boolean() }),
              ),
            }),
          },
        },
      },
      async (request) => {
        return {
          data: successfulValue(
            await notifications.getPreferences.execute({
              actorUserId: authenticatedUserId(request),
            }),
          ),
        };
      },
    );
    app.put<{
      Params: Static<typeof PreferenceParams>;
      Body: Static<typeof PreferenceBody>;
    }>(
      "/preferences/:channel",
      {
        schema: {
          params: PreferenceParams,
          body: PreferenceBody,
          response: { 204: Type.Null(), 400: ErrorResponse },
        },
      },
      async (request, reply) => {
        successfulValue(
          await notifications.updatePreference.execute({
            actorUserId: authenticatedUserId(request),
            channel: request.params.channel,
            enabled: request.body.enabled,
          }),
        );
        return reply.status(204).send();
      },
    );
  };
}
function authenticatedUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw Object.assign(new Error("Authentication required"), {
      statusCode: 401,
    });
  }
  return userId;
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
