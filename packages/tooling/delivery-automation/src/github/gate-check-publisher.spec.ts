import { describe, expect, it, vi } from "vitest";

import { publishGateCheck } from "./gate-check-publisher.js";

describe("publishGateCheck", () => {
  it("publishes a successful completed check on the supplied head SHA", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ id: 42, html_url: "https://github.test/check/42" }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
    );

    await expect(
      publishGateCheck({
        repository: "Oxelio/Architecture-Web",
        repositoryToken: "repo-token",
        name: "Architecture Web / Work Merge Gate",
        headSha: "a".repeat(40),
        title: "Work Merge Gate: PASS",
        summary: "Gate passed.",
        pass: true,
        fetchImpl,
      }),
    ).resolves.toEqual({ id: 42, url: "https://github.test/check/42" });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: "Architecture Web / Work Merge Gate",
      head_sha: "a".repeat(40),
      status: "completed",
      conclusion: "success",
    });
  });

  it("publishes a failing check when the gate does not pass", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ id: 43, html_url: "https://github.test/check/43" }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
    );

    await publishGateCheck({
      repository: "Oxelio/Architecture-Web",
      repositoryToken: "repo-token",
      name: "Architecture Web / Work Merge Gate",
      headSha: "b".repeat(40),
      title: "Work Merge Gate: FAIL",
      summary: "Blocked.",
      pass: false,
      fetchImpl,
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body)).conclusion).toBe("failure");
  });

  it("rejects an invalid target SHA before calling GitHub", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(),
    );

    await expect(
      publishGateCheck({
        repository: "Oxelio/Architecture-Web",
        repositoryToken: "repo-token",
        name: "gate",
        headSha: "not-a-sha",
        title: "gate",
        summary: "gate",
        pass: false,
        fetchImpl,
      }),
    ).rejects.toThrow("Invalid gate check head SHA");

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
