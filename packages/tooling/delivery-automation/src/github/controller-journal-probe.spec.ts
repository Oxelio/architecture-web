import { describe, expect, it, vi } from "vitest";

import { verifyControllerJournalEnforcement } from "./controller-journal-probe.js";

const ref = "refs/tags/delivery-control/disabled-probe-123";
const input = {
  runId: 123,
  mainSha: "a".repeat(40),
  parentSha: "b".repeat(40),
  workflowToken: "workflow",
  controllerToken: "controller",
};

function denial() {
  return Response.json(
    { message: "Repository rule violations found" },
    { status: 422 },
  );
}

function reference(status: number, sha = input.mainSha) {
  return Response.json({ ref, object: { type: "commit", sha } }, { status });
}

function mockGitHub(...results: Response[]) {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const result of results) {
    fetchImpl.mockResolvedValueOnce(result);
  }
  return fetchImpl;
}

describe("controller journal enforcement probe", () => {
  it("uses only its exact test tag and separates ordinary creation from controller operations", async () => {
    const fetchImpl = mockGitHub(
      new Response(null, { status: 404 }),
      denial(),
      reference(201),
      denial(),
      denial(),
      reference(200),
    );

    await expect(
      verifyControllerJournalEnforcement({ ...input, fetchImpl }),
    ).resolves.toEqual({
      ref,
      sha: input.mainSha,
      ordinaryCreation: "denied",
      controllerCreation: "allowed",
      controllerUpdate: "denied",
      controllerDeletion: "denied",
    });
    expect(
      fetchImpl.mock.calls.map(([url, request]) => ({
        path: String(url).replace(
          "https://api.github.com/repos/Oxelio/architecture-web/git/",
          "",
        ),
        method: request?.method,
        actor: new Headers(request?.headers).get("authorization"),
      })),
    ).toEqual([
      {
        path: "ref/tags/delivery-control/disabled-probe-123",
        method: "GET",
        actor: "Bearer workflow",
      },
      { path: "refs", method: "POST", actor: "Bearer workflow" },
      { path: "refs", method: "POST", actor: "Bearer controller" },
      {
        path: "refs/tags/delivery-control/disabled-probe-123",
        method: "PATCH",
        actor: "Bearer controller",
      },
      {
        path: "refs/tags/delivery-control/disabled-probe-123",
        method: "DELETE",
        actor: "Bearer controller",
      },
      {
        path: "ref/tags/delivery-control/disabled-probe-123",
        method: "GET",
        actor: "Bearer workflow",
      },
    ]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      ref,
      sha: input.mainSha,
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({
      sha: input.parentSha,
      force: true,
    });
  });

  it("rejects both missing credential scope and an ordinary creation that unexpectedly succeeds", async () => {
    for (const response of [
      Response.json(
        { message: "Resource not accessible by integration" },
        { status: 403 },
      ),
      reference(201),
    ]) {
      const fetchImpl = mockGitHub(
        new Response(null, { status: 404 }),
        response,
      );
      await expect(
        verifyControllerJournalEnforcement({ ...input, fetchImpl }),
      ).rejects.toThrow("ordinary creation");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("stops without creating a ref when the probe ref already exists", async () => {
    const fetchImpl = mockGitHub(reference(200));
    await expect(
      verifyControllerJournalEnforcement({ ...input, fetchImpl }),
    ).rejects.toThrow("unused probe reference");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requires the unchanged exact ref after both mutation denials", async () => {
    const fetchImpl = mockGitHub(
      new Response(null, { status: 404 }),
      denial(),
      reference(201),
      denial(),
      denial(),
      reference(200, input.parentSha),
    );
    await expect(
      verifyControllerJournalEnforcement({ ...input, fetchImpl }),
    ).rejects.toThrow("target is inconsistent");
  });

  it.each([
    { runId: 0 },
    { mainSha: "invalid" },
    { parentSha: input.mainSha },
    { controllerToken: input.workflowToken },
  ])(
    "rejects invalid probe context before accessing GitHub",
    async (overrides) => {
      const fetchImpl = mockGitHub();
      await expect(
        verifyControllerJournalEnforcement({
          ...input,
          ...overrides,
          fetchImpl,
        }),
      ).rejects.toThrow("Invalid probe context");
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("requires positive controller creation and the exact ref before attempting to update it", async () => {
    for (const result of [
      new Response(null, { status: 422 }),
      reference(201, input.parentSha),
    ]) {
      const fetchImpl = mockGitHub(
        new Response(null, { status: 404 }),
        denial(),
        result,
      );
      await expect(
        verifyControllerJournalEnforcement({ ...input, fetchImpl }),
      ).rejects.toThrow(/probe ref/i);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    }
  });

  it.each([
    { name: "update", results: () => [reference(200)], calls: 4 },
    {
      name: "deletion",
      results: () => [denial(), new Response(null, { status: 204 })],
      calls: 5,
    },
  ])(
    "fails when controller $name unexpectedly succeeds",
    async ({ name, results, calls }) => {
      const fetchImpl = mockGitHub(
        new Response(null, { status: 404 }),
        denial(),
        reference(201),
        ...results(),
      );
      await expect(
        verifyControllerJournalEnforcement({ ...input, fetchImpl }),
      ).rejects.toThrow(`controller ${name}`);
      expect(fetchImpl).toHaveBeenCalledTimes(calls);
    },
  );

  it("does not retry a lost controller creation response", async () => {
    const fetchImpl = mockGitHub(new Response(null, { status: 404 }), denial());
    fetchImpl.mockRejectedValueOnce(new Error("connection interrupted"));
    await expect(
      verifyControllerJournalEnforcement({ ...input, fetchImpl }),
    ).rejects.toThrow("connection interrupted");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
