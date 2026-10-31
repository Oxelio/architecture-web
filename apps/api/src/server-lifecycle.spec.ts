import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  dispose: vi.fn(),
  failure: new Error("Authentication plugin initialization failed"),
}));

vi.mock("./composition-root/application.module.js", () => ({
  buildApplicationModule: async () => ({
    iam: { authentication: {} },
    securityEvents: {},
    dispose: state.dispose,
  }),
}));
vi.mock("./auth.js", () => ({
  authPlugin: async () => {
    throw state.failure;
  },
  buildSessionCookieOptions: () => ({}),
  SESSION_COOKIE_NAME: "session",
}));

import { buildServer } from "./server.js";

describe("server worker lifecycle", () => {
  it("disposes the application when a later plugin fails to initialize", async () => {
    await expect(buildServer()).rejects.toBe(state.failure);
    expect(state.dispose).toHaveBeenCalledOnce();
  });
});
