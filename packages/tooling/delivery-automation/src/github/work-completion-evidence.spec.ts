import { describe, expect, it } from "vitest";

import {
  isPilotCompletionRecord,
  issueDisposition,
  matchesCompletedCandidate,
} from "./work-completion-evidence.js";

const record = {
  kind: "work-completion" as const,
  workNumber: 97,
  pullNumber: 98,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
  mergeSha: "c".repeat(40),
  scopeConcluded: true,
  reviewsAccepted: true,
  validationSufficient: true,
  durableOwnersSynchronized: true,
  workingDecisionsResolved: true,
  postMergeObligationsSatisfied: true,
};
const repo = { id: 1336937640 };
const pr = {
  number: 98,
  state: "closed",
  merged: true,
  body: "Refs #97",
  merge_commit_sha: record.mergeSha,
  head: { repo, sha: record.headSha },
  base: { repo, ref: "main" },
};
const commit = { sha: record.mergeSha, parents: [{ sha: record.baseSha }] };
const comparison = {
  status: "ahead",
  merge_base_commit: { sha: record.mergeSha },
};

describe("completion pilot evidence", () => {
  it("only accepts a separate pilot record", () => {
    expect(isPilotCompletionRecord(record, 98)).toBe(true);
    expect(isPilotCompletionRecord({ ...record, workNumber: 91 }, 98)).toBe(
      false,
    );
    expect(isPilotCompletionRecord({ ...record, workNumber: 93 }, 98)).toBe(
      false,
    );
    expect(isPilotCompletionRecord(record, 94)).toBe(false);
  });

  it("requires unique Work ownership and a candidate on main", () => {
    expect(
      matchesCompletedCandidate(record, pr, commit, comparison, repo.id),
    ).toBe(true);
    expect(
      matchesCompletedCandidate(
        record,
        { ...pr, body: "Refs #97\nRefs #91" },
        commit,
        comparison,
        repo.id,
      ),
    ).toBe(false);
    expect(
      matchesCompletedCandidate(
        record,
        { ...pr, merged: false },
        commit,
        comparison,
        repo.id,
      ),
    ).toBe(false);
    expect(
      matchesCompletedCandidate(
        record,
        pr,
        { ...commit, parents: [{ sha: record.headSha }] },
        comparison,
        repo.id,
      ),
    ).toBe(false);
    expect(
      matchesCompletedCandidate(
        record,
        pr,
        commit,
        { ...comparison, status: "diverged" },
        repo.id,
      ),
    ).toBe(false);
  });

  it("preserves explicit issue dispositions and refuses incomplete history", () => {
    const open = { state: "open", state_reason: null };
    expect(issueDisposition(open, [])).toBe("open");
    expect(issueDisposition(open, [{ event: "reopened" }])).toBe("other");
    expect(
      issueDisposition(
        open,
        Array.from({ length: 100 }, () => ({ event: "commented" })),
      ),
    ).toBe("other");
    expect(
      issueDisposition({ state: "closed", state_reason: "not_planned" }, []),
    ).toBe("other");
    expect(
      issueDisposition({ state: "closed", state_reason: "completed" }, []),
    ).toBe("completed");
  });
});
