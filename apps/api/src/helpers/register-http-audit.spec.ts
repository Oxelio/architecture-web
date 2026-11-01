import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerHttpAudit } from "./register-http-audit.js";

describe("HTTP Audit route confidentiality", () => {
  it.each([
    [200, "success"],
    [403, "denied"],
    [500, "technical_failure"],
    [503, "technical_failure"],
  ] as const)("classifies HTTP %s as %s", async (status, outcome) => {
    const app = Fastify(),
      record = vi.fn();
    registerHttpAudit(app, { record });
    app.post("/v1/iam/signin", async (_request, reply) =>
      reply.code(status).send(),
    );
    try {
      await app.inject({ method: "POST", url: "/v1/iam/signin" });
      expect(record.mock.calls[0]?.[1]).toBe(outcome);
    } finally {
      await app.close();
    }
  });
  it.each([
    ["/v1/iam/me/sessions/canary-bearer", "/v1/iam/me/sessions/:sessionId"],
    [
      "/v1/iam/users/account/sessions/canary%2Dbearer",
      "/v1/iam/users/:userId/sessions/:sessionId",
    ],
    ["/v1/iam/me/sessions%2Fcanary-bearer", "[unmatched]"],
    ["/v1/iam/me/sessions/extra/canary-bearer", "[unmatched]"],
  ])(
    "excludes concrete parameters and unmatched URLs: %s",
    async (url, template) => {
      const app = Fastify(),
        record = vi.fn();
      registerHttpAudit(app, { record });
      app.delete("/v1/iam/me/sessions/:sessionId", async (_request, reply) =>
        reply.code(403).send(),
      );
      app.delete(
        "/v1/iam/users/:userId/sessions/:sessionId",
        async (_request, reply) => reply.code(403).send(),
      );
      try {
        const response = await app.inject({
          method: "DELETE",
          url: url + "?token=canary-query",
        });
        expect(response.statusCode).toBe(
          template === "[unmatched]" ? 404 : 403,
        );
        expect(record).toHaveBeenCalledWith(
          "session.revoked",
          "denied",
          expect.any(Object),
          {
            method: "DELETE",
            route: template,
            statusCode: response.statusCode,
          },
        );
        expect(JSON.stringify(record.mock.calls)).not.toMatch(/canary|%2D/i);
      } finally {
        await app.close();
      }
    },
  );

  it("preserves legitimate collection-route and sign-in auditing", async () => {
    const app = Fastify(),
      record = vi.fn();
    registerHttpAudit(app, { record });
    app.get("/v1/iam/me/sessions", async () => ({ sessions: [] }));
    app.post("/v1/iam/signin", async () => ({ success: true }));
    try {
      await app.inject({ method: "GET", url: "/v1/iam/me/sessions" });
      await app.inject({ method: "POST", url: "/v1/iam/signin" });
      expect(record.mock.calls.map((call) => call.slice(0, 2))).toEqual([
        ["session.consulted", "success"],
        ["authentication.signin", "success"],
      ]);
      expect(record.mock.calls[0]?.[3]).toEqual({
        method: "GET",
        route: "/v1/iam/me/sessions",
        statusCode: 200,
      });
    } finally {
      await app.close();
    }
  });
});
