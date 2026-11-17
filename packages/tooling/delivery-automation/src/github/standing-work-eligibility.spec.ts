import { describe, expect, it } from "vitest";

import {
  activationMappingNames,
  parseActivationManifest,
} from "../config/activation-manifest.js";
import {
  readStandingWorkFacts,
  verifyStandingWorkEligibility,
} from "./standing-work-eligibility.js";

const candidate = {
  workNumber: 10,
  pullNumber: 20,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};

function fixture() {
  const state = {
    type: "Technical Change",
    labels: ["char:operational"],
    previous: ".github/workflows/old.yml",
    changed: 1,
    pullReads: 0,
    stale: false,
  };
  const manifest = parseActivationManifest({
    schemaVersion: 1,
    policyOwner: "docs/project/delivery-pipeline.md",
    project: { owner: "Oxelio", number: 3 },
    mappings: Object.fromEntries(
      activationMappingNames.map((name) => [
        name,
        { status: "verified", evidenceRef: "fixture" },
      ]),
    ),
  });
  const reader = {
    manifest,
    repository: "Oxelio/architecture-web",
    repositoryToken: "repository-reader",
    projectsToken: "project-reader",
    projectId: "test-project",
    fetchImpl: async (url: RequestInfo | URL) => {
      const path = new URL(String(url)).pathname;
      if (path === "/graphql") {
        return Response.json({
          data: {
            repository: {
              nameWithOwner: "Oxelio/architecture-web",
              issue: {
                number: candidate.workNumber,
                state: "OPEN",
                parent: null,
                labels: {
                  nodes: state.labels.map((name) => ({ name })),
                  pageInfo: { hasNextPage: false },
                },
                projectItems: {
                  nodes: [
                    {
                      project: { id: "test-project", closed: false },
                      status: { name: "Validating" },
                      workType: { name: state.type },
                      workflowDepth: { name: "Standard" },
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          },
        });
      }
      if (path.endsWith("/files")) {
        return Response.json([
          {
            status: "renamed",
            filename: "docs/new.md",
            previous_filename: state.previous,
          },
        ]);
      }
      state.pullReads++;
      return Response.json({
        number: candidate.pullNumber,
        body: "Refs #10",
        state: "open",
        draft: false,
        merged: false,
        changed_files: state.changed,
        head: {
          sha:
            state.stale && state.pullReads === 2
              ? "c".repeat(40)
              : candidate.headSha,
          repo: { id: 1336937640 },
        },
        base: { sha: candidate.baseSha, ref: "main", repo: { id: 1336937640 } },
      });
    },
  };
  return { reader, state };
}

describe("standing Work eligibility evidence", () => {
  it("binds accepted impact to the candidate, classification and both rename paths", async () => {
    const f = fixture();
    const facts = await readStandingWorkFacts(f.reader, candidate);
    expect(facts?.changedPaths).toEqual([
      ".github/workflows/old.yml",
      "docs/new.md",
    ]);
    const input = {
      reader: f.reader,
      candidate,
      readAcceptedImpact: async () => ({
        candidate,
        disposition: "ordinary" as const,
        factsDigest: facts?.digest ?? "",
      }),
    };
    expect(await verifyStandingWorkEligibility(input)).toBe(false);
    f.state.previous = "docs/old.md";
    const ordinary = await readStandingWorkFacts(f.reader, candidate);
    const ordinaryInput = {
      ...input,
      readAcceptedImpact: async () => ({
        candidate,
        disposition: "ordinary" as const,
        factsDigest: ordinary?.digest ?? "",
      }),
    };
    expect(await verifyStandingWorkEligibility(ordinaryInput)).toBe(true);
    f.state.labels = ["char:security"];
    expect(await verifyStandingWorkEligibility(ordinaryInput)).toBe(false);
  });

  it("fails closed on incomplete diffs, unrecognized labels, and changed candidates", async () => {
    for (const fault of [
      { changed: 2 },
      { labels: ["char:unknown"] },
      { stale: true },
      { type: "Governance Change" },
    ]) {
      const f = fixture();
      Object.assign(f.state, fault);
      expect(await readStandingWorkFacts(f.reader, candidate)).toBeNull();
    }
  });

  it("requires the accepted impact assessment to allow standing integration", async () => {
    const { reader, state } = fixture();
    state.previous = "docs/old.md";
    const facts = await readStandingWorkFacts(reader, candidate);
    expect(
      await verifyStandingWorkEligibility({
        reader,
        candidate,
        readAcceptedImpact: async () => ({
          candidate,
          disposition: "manual",
          factsDigest: facts?.digest ?? "",
        }),
      }),
    ).toBe(false);
  });
});
