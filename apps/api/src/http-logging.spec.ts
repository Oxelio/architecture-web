import { Writable } from "node:stream";

import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registerHttpAudit } from "./helpers/register-http-audit.js";
import {
  httpLoggingOptions,
  registerHttpRequestLogging,
} from "./http-logging.js";
import { errorHandler } from "./types/error-handler.js";

describe("HTTP logging confidentiality", () => {
  it("preserves safe diagnostics without emitting synthetic secrets", async () => {
    const token = "SYNTHETIC_CANARY_145_+/";
    const encodedToken = encodeURIComponent(token);
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk.toString("utf8"));
        callback();
      },
    });
    const app = Fastify(httpLoggingOptions(stream));
    registerHttpRequestLogging(app);
    app.setErrorHandler(errorHandler);
    registerHttpAudit(app, {
      record: async () => {
        throw new Error("audit writer failed with " + token);
      },
    });
    app.get<{ Querystring: { invalid?: string } }>(
      "/v1/iam/verify",
      async (request, reply) =>
        request.query.invalid
          ? reply
              .code(400)
              .send({ error: { code: "email_verification.invalid_token" } })
          : reply.code(204).send(),
    );
    // The approved new POST-body transport is exercised without changing
    // current production IAM routing (which belongs to Work #152).
    app.post("/v1/iam/verify", async (_request, reply) =>
      reply
        .code(400)
        .send({ error: { code: "email_verification.invalid_token" } }),
    );
    app.get("/items/:itemId", async (request) => {
      request.log.info({ req: request }, "serialized request diagnostic");
      return { ok: true };
    });
    app.post(
      "/validation",
      {
        schema: {
          body: {
            type: "object",
            required: ["expected"],
            additionalProperties: false,
            properties: { expected: { type: "integer" } },
          },
        },
      },
      async () => ({ ok: true }),
    );
    app.get("/unexpected", async () => {
      throw new Error("unexpected error " + token);
    });
    app.post("/v1/iam/signin", async () => ({ ok: true }));
    const headers = {
      authorization: "Bearer " + token,
      cookie: "session=" + token,
      "request-id": token,
    };
    try {
      const outcomes = await Promise.all([
        app.inject({
          method: "GET",
          url: "/v1/iam/verify?token=" + encodedToken,
          headers,
        }),
        app.inject({
          method: "GET",
          url: "/v1/iam/verify?token=" + encodedToken + "&invalid=1",
          headers,
        }),
        app.inject({
          method: "POST",
          url: "/v1/iam/verify",
          headers: { ...headers, "content-type": "application/json" },
          payload: JSON.stringify({ token }),
        }),
        app.inject({
          method: "GET",
          url: "/items/" + encodedToken + "?token=" + encodedToken,
          headers,
        }),
        app.inject({
          method: "POST",
          url: "/validation?token=" + encodedToken,
          headers: { ...headers, "content-type": "application/json" },
          payload: JSON.stringify({ expected: token }),
        }),
        app.inject({
          method: "GET",
          url: "/unexpected?token=" + encodedToken,
          headers,
        }),
        app.inject({
          method: "GET",
          url: "/no-such-route/" + encodedToken + "?token=" + encodedToken,
          headers,
        }),
        app.inject({
          method: "POST",
          url: "/v1/iam/signin?token=" + encodedToken,
          headers,
        }),
      ]);
      expect(outcomes.map((response) => response.statusCode)).toEqual([
        204, 400, 400, 200, 400, 500, 404, 200,
      ]);
      app.log.error({ err: new Error(token) }, "technical error diagnostic");
      const output = chunks.join("");
      expect(output).not.toContain(token);
      expect(output).not.toContain(encodedToken);
      expect(output).not.toContain("Bearer ");
      expect(output).not.toContain("session=");
      const records = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const completed = records.filter(
        (record) => record["msg"] === "HTTP request completed",
      );
      expect(completed).toHaveLength(8);
      expect(completed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            route: "/v1/iam/verify",
            statusCode: 204,
          }),
          expect.objectContaining({
            method: "POST",
            route: "/v1/iam/verify",
            statusCode: 400,
          }),
          expect.objectContaining({
            method: "GET",
            route: "/items/:itemId",
            statusCode: 200,
          }),
          expect.objectContaining({
            method: "GET",
            route: "[unmatched]",
            statusCode: 404,
          }),
        ]),
      );
      for (const record of completed) {
        expect(typeof record["requestId"]).toBe("string");
        expect(typeof record["durationMs"]).toBe("number");
        expect(record).not.toHaveProperty("url");
        expect(record).not.toHaveProperty("headers");
        expect(record).not.toHaveProperty("body");
      }
      expect(
        records.some(
          (record) => record["errorCategory"] === "request.validation_failed",
        ),
      ).toBe(true);
      expect(
        records.some(
          (record) => record["errorCategory"] === "internal.unexpected_error",
        ),
      ).toBe(true);
      expect(
        records.some(
          (record) => record["errorCategory"] === "audit_write_failed",
        ),
      ).toBe(true);
      expect(
        records.some(
          (record) =>
            record["msg"] === "technical error diagnostic" &&
            (record["err"] as { category: string }).category ===
              "redacted_error",
        ),
      ).toBe(true);
    } finally {
      await app.close();
    }
  });
});
