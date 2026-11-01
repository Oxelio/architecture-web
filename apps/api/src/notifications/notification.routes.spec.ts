import type { NotificationsApplication } from "@architecture/notifications/application";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { errorHandler } from "#types/error-handler";

import { buildNotificationRoutes } from "./notification.routes.js";

async function server() {
  const execute = vi
    .fn()
    .mockResolvedValue({ success: true, value: undefined });
  const list = vi.fn().mockResolvedValue({
    success: true,
    value: [
      {
        id: "notification",
        type: "security",
        severity: "warning",
        title: "title",
        message: "message",
        action: "view_account",
        createdAt: new Date("2026-01-01"),
        readAt: null,
      },
    ],
  });
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorateRequest("auth", null);
  app.decorate("authenticate", async (request) => {
    request.auth = { userId: "owner", sessionId: "session", role: "user" };
  });
  await app.register(
    buildNotificationRoutes({
      listNotifications: { execute: list },
      updatePreference: { execute },
    } as unknown as NotificationsApplication),
  );
  return { app, execute, list };
}
describe("Notifications HTTP contracts", () => {
  it("serializes dates and business actions and uses the authenticated owner", async () => {
    const { app, list } = await server();
    try {
      const response = await app.inject({ url: "/?page=2&pageSize=10" });
      expect(response.statusCode).toBe(200);
      expect(response.json().data[0]).toMatchObject({
        action: "view_account",
        createdAt: "2026-01-01T00:00:00.000Z",
        readAt: null,
      });
      expect(list).toHaveBeenCalledWith({
        actorUserId: "owner",
        page: 2,
        pageSize: 10,
      });
    } finally {
      await app.close();
    }
  });
  it.each([undefined, null, {}, { enabled: "invalid" }])(
    "rejects malformed preference input %j",
    async (payload) => {
      const { app, execute } = await server();
      try {
        const response = await app.inject({
          method: "PUT",
          url: "/preferences/email",
          ...(payload !== undefined
            ? {
                payload: JSON.stringify(payload),
                headers: { "content-type": "application/json" },
              }
            : {}),
        });
        expect(response.statusCode).toBe(400);
        expect(execute).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );
  it("rejects an unsupported channel and pagination without executing the use case", async () => {
    const { app, execute, list } = await server();
    try {
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/preferences/unknown",
            payload: { enabled: true },
          })
        ).statusCode,
      ).toBe(400);
      expect((await app.inject({ url: "/?pageSize=101" })).statusCode).toBe(
        400,
      );
      expect(execute).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
