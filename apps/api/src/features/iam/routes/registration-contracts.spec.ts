import { expect, it, vi } from "vitest";

import { buildNotificationRoutes } from "#app/notifications/notification.routes";

import { registerAdminRoutes } from "./admin.routes.js";
import { buildIamRoutes } from "./index.js";
import { registerProtectedRoutes } from "./protected.routes.js";
import { registerPublicRoutes } from "./public.routes.js";

vi.mock("#iam/compose-controllers", () => ({
  composeIamControllers: () => ({}),
}));

const plugins = [
  ["public", () => registerPublicRoutes({} as never)],
  ["protected", () => registerProtectedRoutes({} as never)],
  ["admin", () => registerAdminRoutes({} as never)],
  ["IAM composition", () => buildIamRoutes({} as never, {} as never)],
  ["notifications", () => buildNotificationRoutes({} as never)],
] as const;

it.each(plugins)(
  "%s registration returns a Promise and rejects synchronous registration errors",
  async (_, build) => {
    const plugin = build();
    const operations = new Proxy({}, { get: () => () => undefined });
    const success = plugin(operations as never);
    expect(success).toBeInstanceOf(Promise);
    await expect(success).resolves.toBeUndefined();
    const failure = new Error("Registration unavailable");
    const rejected = plugin(
      new Proxy(
        {},
        {
          get: () => () => {
            throw failure;
          },
        },
      ) as never,
    );
    expect(rejected).toBeInstanceOf(Promise);
    await expect(rejected).rejects.toBe(failure);
  },
);

it.each(["user", "admin"])(
  "admin authorization preserves the Promise hook for role %s",
  async (role) => {
    const hooks: ((request: unknown, reply: unknown) => Promise<unknown>)[] =
      [];
    const operations = new Proxy(
      {},
      {
        get: (_, name) =>
          name === "addHook"
            ? (_event: string, hook: (typeof hooks)[number]) => hooks.push(hook)
            : () => undefined,
      },
    );
    await registerAdminRoutes({} as never)(operations as never);
    const reply = { status: vi.fn(), send: vi.fn() };
    reply.status.mockReturnValue(reply);
    reply.send.mockReturnValue({ sent: true });
    const result = hooks[1]?.({ auth: { role } }, reply);
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(reply.status).toHaveBeenCalledTimes(role === "admin" ? 0 : 1);
    if (role !== "admin") {
      expect(reply.send).toHaveBeenCalledWith({
        error: { code: "authorization.forbidden" },
      });
    }
  },
);
