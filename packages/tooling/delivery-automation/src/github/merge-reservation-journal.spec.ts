import { describe, expect, it } from "vitest";

import {
  appendMergeJournalRevision,
  readMergeJournalRevision,
} from "./merge-reservation-journal.js";

const head = "a".repeat(40);
const tagSha = "b".repeat(40);
const previous = { revision: 1, tagSha: "c".repeat(40) };
const input = {
  repositoryToken: "fixture",
  previous,
  candidateHeadSha: head,
  body: '{"phase":"pending"}',
};
const message = JSON.stringify({
  revision: 2,
  previous: previous.tagSha,
  body: input.body,
});
const tag = {
  tag: "delivery-control/r2",
  sha: tagSha,
  message,
  object: { type: "commit", sha: head },
};
const ref = {
  ref: "refs/tags/delivery-control/r2",
  object: { type: "tag", sha: tagSha },
};

describe("GitHub merge reservation journal", () => {
  it("requires exact creation of the next immutable revision", async () => {
    const requests: string[] = [];
    const result = await appendMergeJournalRevision({
      ...input,
      fetchImpl: async (url) => {
        requests.push(String(url));
        return Response.json(requests.length === 1 ? tag : ref, {
          status: 201,
        });
      },
    });
    expect(result).toEqual({
      status: "committed",
      position: { revision: 2, tagSha },
    });
    expect(requests.map((url) => url.split("/").at(-1))).toEqual([
      "tags",
      "refs",
    ]);
  });

  it("does not authorize a second effect on conflicts, response loss or wrong refs", async () => {
    for (const outcome of ["conflict", "lost", "wrong-ref"]) {
      let calls = 0;
      const result = await appendMergeJournalRevision({
        ...input,
        fetchImpl: async () => {
          calls++;
          if (calls === 1) {
            return Response.json(tag, { status: 201 });
          }
          if (outcome === "lost") {
            throw new Error("simulated loss");
          }
          return outcome === "conflict"
            ? Response.json({}, { status: 422 })
            : Response.json(
                { ...ref, ref: "refs/tags/other" },
                { status: 201 },
              );
        },
      });
      expect(result).toEqual({ status: "not-confirmed" });
      expect(calls).toBe(2);
    }
  });

  it("validates the revision, annotated tag and predecessor before reading a receipt", async () => {
    const result = await readMergeJournalRevision({
      repositoryToken: "fixture",
      revision: 2,
      fetchImpl: async (url) =>
        Response.json(String(url).includes("/ref/") ? ref : tag),
    });
    expect(result).toEqual({
      revision: 2,
      tagSha,
      previous: previous.tagSha,
      body: input.body,
    });
  });
});
