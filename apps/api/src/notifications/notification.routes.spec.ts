import type { NotificationsApplication } from "@architecture/notifications/application";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { errorHandler } from "#types/error-handler";

import { buildNotificationRoutes } from "./notification.routes.js";

const notification = {
  id: "notification",
  type: "security",
  severity: "warning",
  title: "title",
  message: "message",
  action: "view_account",
  createdAt: new Date("2026-01-01"),
  readAt: null,
};

async function server({
  principal = "owner",
  parsedQuery,
}: {
  principal?: string | null;
  parsedQuery?: Record<string, unknown>;
} = {}) {
  const execute = vi
    .fn()
    .mockResolvedValue({ success: true, value: undefined });
  const list = vi.fn().mockResolvedValue({
    success: true,
    value: [notification],
  });
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorateRequest("auth", null);
  app.decorate("authenticate", async (request) => {
    if (principal !== null) {
      request.auth = { userId: principal, sessionId: "session", role: "user" };
    }
  });
  if (parsedQuery) {
    app.addHook("preValidation", async (request) => {
      Object.assign(request.query as Record<string, unknown>, parsedQuery);
    });
  }
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
  it("lists only the authenticated account's notifications", async () => {
    const { app, list } = await server({
      parsedQuery: { actorUserId: "other" },
    });
    const notificationsByAccount = new Map([
      ["owner", [{ ...notification, id: "owner-notification" }]],
      ["other", [{ ...notification, id: "other-notification" }]],
    ]);
    list.mockImplementation(
      async ({ actorUserId }: { actorUserId: string }) => ({
        success: true,
        value: notificationsByAccount.get(actorUserId) ?? [],
      }),
    );
    try {
      const response = await app.inject({ url: "/?page=2&pageSize=10" });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([
        expect.objectContaining({ id: "owner-notification" }),
      ]);
      expect(list).toHaveBeenCalledExactlyOnceWith({
        actorUserId: "owner",
        page: 2,
        pageSize: 10,
      });
    } finally {
      await app.close();
    }
  });
  it.each([null, ""])(
    "rejects notification listing without a valid principal (%j)",
    async (principal) => {
      const { app, list } = await server({ principal });
      try {
        expect((await app.inject({ url: "/" })).statusCode).toBe(401);
        expect(list).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );
  it.each([
    ["/", {}],
    ["/?page=1", { page: 1 }],
    ["/?pageSize=100", { pageSize: 100 }],
  ])("preserves pagination for %s", async (url, pagination) => {
    const { app, list } = await server();
    try {
      expect((await app.inject({ url })).statusCode).toBe(200);
      expect(list.mock.calls).toStrictEqual([
        [{ actorUserId: "owner", ...pagination }],
      ]);
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
