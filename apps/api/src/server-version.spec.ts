import { describe, expect, it, vi } from "vitest";

const packageMetadata = vi.hoisted(() => ({ version: "0.1.0" }));
vi.mock("#package", () => ({ default: packageMetadata }));
vi.mock("./composition-root/application.module.js", () => ({
  buildApplicationModule: async () => ({
    iam: { accounts: {}, authentication: {}, administration: {} },
    audit: {},
    notifications: {},
    configuration: {},
    securityEvents: {},
    dispose: vi.fn(),
  }),
}));

describe("HTTP contract version independence", () => {
  it.each(["0.1.0", "2.0.0"])(
    "preserves /v1 with project version %s",
    async (version) => {
      vi.resetModules();
      packageMetadata.version = version;
      const { buildServer } = await import("./server.js");
      const server = await buildServer();
      try {
        await server.ready();
        expect(server.hasRoute({ method: "POST", url: "/v1/iam/signin" })).toBe(
          true,
        );
        expect(
          server.hasRoute({
            method: "POST",
            url: `/v${version.split(".")[0]}/iam/signin`,
          }),
        ).toBe(false);
        const documentation = await server.inject({
          method: "GET",
          url: "/docs/json",
        });
        expect(documentation.statusCode).toBe(200);
        expect(
          documentation.json<{ info: { version: string } }>().info.version,
        ).toBe(version);
      } finally {
        await server.close();
      }
    },
  );
});
