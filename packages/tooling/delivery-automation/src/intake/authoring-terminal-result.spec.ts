import { expect, it, vi } from "vitest";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import { createPublicAuthoringReceiptReader } from "../github/github-work-reservation-journal.js";
import { createAuthoringTerminalResultReader } from "./authoring-terminal-result.js";

const request: PreparedAuthoringRequest = {
  schema: 1,
  repositoryId: 1336937640,
  workNumber: 140,
  requestId: "a".repeat(64),
  actorDigest: "b".repeat(64),
  commandDigest: "c".repeat(64),
  command: {
    kind: "edit-work",
    beforeStateDigest: "d".repeat(64),
    payloadDigest: "e".repeat(64),
  },
};
const intent = {
  requestId: request.requestId,
  actorDigest: request.actorDigest,
  commandDigest: request.commandDigest,
};

it.each([
  ["confirmed", "confirmed"],
  ["not-applied", "not-applied"],
  ["known-unstarted", "denied"],
])(
  "recovers a matching terminal receipt %s without retrying the operation",
  async (outcome, status) => {
    const readReceipt = vi.fn().mockResolvedValue({ outcome, intent });
    const read = createAuthoringTerminalResultReader({
      maximumHistoryRevisions: 31,
      readReceipt,
    });
    await expect(read(request)).resolves.toEqual({ status, canonicalUrls: [] });
    expect(readReceipt).toHaveBeenCalledWith(request.requestId, 31);
  },
);

it.each([
  null,
  { outcome: "admitted", intent },
  { outcome: "confirmed", intent: { ...intent, requestId: "another" } },
  { outcome: "confirmed", intent: { ...intent, actorDigest: "another" } },
  { outcome: "confirmed", intent: { ...intent, commandDigest: "another" } },
])("withholds a result without positive correlation %#", async (receipt) => {
  const read = createAuthoringTerminalResultReader({
    maximumHistoryRevisions: 31,
    readReceipt: vi.fn().mockResolvedValue(receipt),
  });
  await expect(read(request)).resolves.toBeNull();
});

it("reads the canonical public journal without a credential or write", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
  const reader = createPublicAuthoringReceiptReader(fetchImpl);
  await expect(reader(request.requestId, 31)).resolves.toBeNull();
  expect(fetchImpl).toHaveBeenCalledOnce();
  const [url, options] = fetchImpl.mock.calls[0] ?? [];
  expect(url).toBe(
    "https://api.github.com/repos/Oxelio/architecture-web/git/matching-refs/tags/delivery-control/r",
  );
  expect(options?.method).toBeUndefined();
  expect(new Headers(options?.headers).has("authorization")).toBe(false);
  expect(options?.redirect).toBe("error");
  expect(options?.signal).toBeInstanceOf(AbortSignal);
});

it("keeps the receipt pending if the journal is unavailable", async () => {
  const read = createAuthoringTerminalResultReader({
    maximumHistoryRevisions: 31,
    readReceipt: vi.fn().mockRejectedValue(new Error("unavailable")),
  });
  await expect(read(request)).resolves.toBeNull();
});
