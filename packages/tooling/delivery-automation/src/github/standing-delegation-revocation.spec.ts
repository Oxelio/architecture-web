import { describe, expect, it, vi } from "vitest";

import {
  isStandingDelegationRevoked,
  recordStandingDelegationRevocation,
} from "./standing-delegation-revocation.js";

const delegationCommentId = 12345;
const workflowSha = "a".repeat(40);
const ref = `refs/tags/delivery-control/disabled-${delegationCommentId}`;
const marker = { ref, object: { type: "commit", sha: workflowSha } };
const scope = { repositoryToken: "fixture", delegationCommentId, workflowSha };

describe("durable ordinary standing-delegation revocation", () => {
  it("recognizes only the exact immutable marker", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(marker));
    await expect(
      isStandingDelegationRevoked({ ...scope, fetchImpl }),
    ).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.github.com/repos/Oxelio/architecture-web/git/ref/tags/delivery-control/disabled-${delegationCommentId}`,
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("does not count an unrelated or unverifiable marker as live authority", async () => {
    for (const response of [
      Response.json({
        ...marker,
        ref: "refs/tags/delivery-control/disabled-9",
      }),
      new Response(null, { status: 503 }),
    ]) {
      await expect(
        isStandingDelegationRevoked({
          ...scope,
          fetchImpl: async () => response,
        }),
      ).rejects.toThrow("STANDING_REVOCATION_MARKER_UNVERIFIED");
    }
  });

  it("records one marker with the controller credential and verifies read-back", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(marker, { status: 201 }))
      .mockResolvedValueOnce(Response.json(marker));
    await expect(
      recordStandingDelegationRevocation({ ...scope, fetchImpl }),
    ).resolves.toBe(true);
    expect(fetchImpl.mock.calls.map(([, options]) => options?.method)).toEqual([
      "GET",
      "POST",
      "GET",
    ]);
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify({ ref, sha: workflowSha }),
      headers: { authorization: "Bearer fixture" },
    });
  });

  it.each([true, false])(
    "reconciles an ambiguous response without repeating the write (%s)",
    async (created) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockRejectedValueOnce(new Error("response lost"))
        .mockResolvedValueOnce(
          created ? Response.json(marker) : new Response(null, { status: 404 }),
        );
      await expect(
        recordStandingDelegationRevocation({ ...scope, fetchImpl }),
      ).resolves.toBe(created);
      expect(
        fetchImpl.mock.calls.map(([, options]) => options?.method),
      ).toEqual(["GET", "POST", "GET"]);
    },
  );

  it("never recreates an already recorded revocation", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(marker));
    await expect(
      recordStandingDelegationRevocation({
        ...scope,
        fetchImpl,
        workflowSha: "b".repeat(40),
      }),
    ).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
