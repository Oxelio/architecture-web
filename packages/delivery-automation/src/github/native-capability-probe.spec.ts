import { describe, expect, it } from "vitest";

import type { FetchLike } from "./github-project-inventory.js";
import { probeNativeDeliveryCapabilities } from "./native-capability-probe.js";

function response(status: number): Response {
  return new Response(status === 200 ? "[]" : "", { status });
}

describe("probeNativeDeliveryCapabilities", () => {
  it("accepts a 404 parent response as evidence that the parent endpoint is readable", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.endsWith("/parent")) {
        return response(404);
      }
      return response(200);
    };

    await expect(
      probeNativeDeliveryCapabilities({
        repository: "Oxelio/Architecture-Web",
        issueNumber: 9,
        repositoryToken: "token",
        fetchImpl,
      }),
    ).resolves.toEqual({
      dependencies: true,
      taskParent: true,
      workIntegrationPr: true,
    });
  });

  it("fails closed for unreadable native endpoints", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes("blocked_by")) {
        return response(403);
      }
      if (url.endsWith("/parent")) {
        return response(500);
      }
      return response(404);
    };

    await expect(
      probeNativeDeliveryCapabilities({
        repository: "Oxelio/Architecture-Web",
        issueNumber: 9,
        repositoryToken: "token",
        fetchImpl,
      }),
    ).resolves.toEqual({
      dependencies: false,
      taskParent: false,
      workIntegrationPr: false,
    });
  });
});
