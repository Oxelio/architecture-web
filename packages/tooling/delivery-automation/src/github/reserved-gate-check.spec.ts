import { describe, expect, it } from "vitest";

import {
  completeReservedGateCheck,
  queueReservedGateCheck,
} from "./gate-check-publisher.js";

const scope = {
  repository: "Oxelio/architecture-web",
  checksToken: "test",
  name: "Work Merge Gate",
  headSha: "a".repeat(40),
  reservationId: "reservation-17",
  expectedAppId: 7,
};
const check = {
  id: 17,
  html_url: "https://github.com/Oxelio/architecture-web/runs/17",
  name: scope.name,
  head_sha: scope.headSha,
  external_id: scope.reservationId,
  app: { id: scope.expectedAppId },
  status: "queued",
  conclusion: null,
};
const completion = {
  ...scope,
  checkId: check.id,
  title: "Work Merge Gate: PASS",
  summary: "Current candidate authorized",
};
const successfulCheck = {
  ...check,
  status: "completed",
  conclusion: "success",
};

describe("reserved Work Merge Gate check", () => {
  it("queues a candidate-bound check without publishing success", async () => {
    let request: RequestInit | undefined;
    const result = await queueReservedGateCheck({
      ...scope,
      fetchImpl: async (_url, options) => {
        request = options;
        return Response.json(check, { status: 201 });
      },
    });
    expect(result).toEqual({ id: 17, url: check.html_url });
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({
      name: scope.name,
      head_sha: scope.headSha,
      external_id: scope.reservationId,
      status: "queued",
    });
  });

  it("completes the same verified check ID", async () => {
    const requests: Array<[string, string]> = [];
    const result = await completeReservedGateCheck({
      ...completion,
      fetchImpl: async (url, options) => {
        requests.push([String(url), options?.method ?? "GET"]);
        if (options?.method !== "PATCH") {
          return Response.json(check);
        }
        expect(JSON.parse(String(options.body))).toEqual({
          status: "completed",
          conclusion: "success",
          output: { title: completion.title, summary: completion.summary },
        });
        return Response.json(successfulCheck);
      },
    });
    const url =
      "https://api.github.com/repos/Oxelio/architecture-web/check-runs/17";
    expect(requests).toEqual([
      [url, "GET"],
      [url, "PATCH"],
    ]);
    expect(result).toEqual({ id: 17, url: check.html_url });
  });

  it("refuses a stale or foreign check before PATCH", async () => {
    for (const mismatch of [
      { id: 18 },
      { app: { id: 8 } },
      { external_id: "other reservation" },
      { name: "unrelated check" },
      { head_sha: "b".repeat(40) },
      { status: "completed", conclusion: "success" },
    ]) {
      const methods: string[] = [];
      const result = await completeReservedGateCheck({
        ...completion,
        fetchImpl: async (_url, options) => {
          methods.push(options?.method ?? "GET");
          return Response.json({ ...check, ...mismatch });
        },
      });
      expect(result).toBeNull();
      expect(methods).toEqual(["GET"]);
    }
  });

  it("does not confirm a mismatched completion or retry a lost response", async () => {
    for (const response of [
      () => Response.json({ ...successfulCheck, id: 18 }),
      () => {
        throw new Error("lost response");
      },
    ]) {
      let patches = 0;
      const result = await completeReservedGateCheck({
        ...completion,
        fetchImpl: async (_url, options) => {
          if (options?.method === "PATCH") {
            patches++;
            return response();
          }
          return Response.json(check);
        },
      });
      expect(result).toBeNull();
      expect(patches).toBe(1);
    }
  });
});
