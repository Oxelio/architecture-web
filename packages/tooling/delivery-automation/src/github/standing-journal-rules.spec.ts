import { describe, expect, it, vi } from "vitest";

import {
  type StandingRulesetObservation,
  verifyStandingJournalRules,
} from "./work-merge-publisher.js";

const repository = "Oxelio/architecture-web";
const repositoryId = 1336937640;
const expected = {
  creationRulesetId: 102,
  immutabilityRulesetId: 103,
  controllerAppId: 42,
};
const common = {
  target: "tag",
  updated_at: "2026-11-16T10:00:00Z",
  enforcement: "active",
  conditions: {
    ref_name: {
      include: [
        "refs/tags/delivery-control/r*",
        "refs/tags/delivery-control/disabled-*",
        "refs/tags/delivery-control/status-*",
      ],
      exclude: [],
    },
  },
};
const controller = {
  actor_type: "Integration",
  bypass_mode: "always",
  actor_id: expected.controllerAppId,
};
const creation = {
  ...common,
  id: expected.creationRulesetId,
  rules: [{ type: "creation" }],
  bypass_actors: [controller],
};
const immutability = {
  ...common,
  id: expected.immutabilityRulesetId,
  rules: [{ type: "update" }, { type: "deletion" }],
  bypass_actors: [],
};

function reader(create: object = creation, immutable: object = immutability) {
  const fetchImpl = vi.fn<typeof fetch>(async (url) => {
    const body = String(url).endsWith(`/rulesets/${expected.creationRulesetId}`)
      ? create
      : immutable;
    return Response.json(body);
  });
  return { repository, repositoryId, repositoryToken: "fixture", fetchImpl };
}

describe("standing Work journal rules", () => {
  it("requires separate exclusive creation and unconditional immutability rules", async () => {
    const publisher = reader();
    await expect(verifyStandingJournalRules(publisher, expected)).resolves.toBe(
      true,
    );
    expect(
      publisher.fetchImpl.mock.calls.map(([url, options]) => [
        url,
        options?.method,
      ]),
    ).toEqual([
      [`https://api.github.com/repos/${repository}/rulesets/102`, "GET"],
      [`https://api.github.com/repos/${repository}/rulesets/103`, "GET"],
    ]);
  });

  it.each([
    { ...creation, rules: [{ type: "creation" }, { type: "update" }] },
    { ...creation, enforcement: "evaluate" },
    { ...creation, bypass_actors: [] },
    { ...creation, bypass_actors: [{ ...controller, actor_id: 41 }] },
    {
      ...creation,
      bypass_actors: [controller, { actor_type: "RepositoryRole" }],
    },
    {
      ...creation,
      conditions: { ref_name: { include: ["refs/tags/**"], exclude: [] } },
    },
  ])("rejects drift in creation scope or creator", async (rules) => {
    await expect(
      verifyStandingJournalRules(reader(rules), expected),
    ).resolves.toBe(false);
  });

  it.each([
    { ...immutability, rules: [{ type: "update" }] },
    { ...immutability, target: "branch" },
    { ...immutability, bypass_actors: [controller] },
    { ...immutability, bypass_actors: null },
  ])(
    "rejects removable, replaceable or insufficiently protected entries",
    async (rules) => {
      await expect(
        verifyStandingJournalRules(reader(creation, rules), expected),
      ).resolves.toBe(false);
    },
  );

  it("rejects hidden bypass information without an exact administrative observation", async () => {
    const hidden = { ...creation, bypass_actors: undefined };
    const publisher = reader(hidden);
    const observation: StandingRulesetObservation = {
      repositoryId,
      rulesetId: creation.id,
      updatedAt: common.updated_at,
      enforcement: common.enforcement,
      target: common.target,
      conditions: common.conditions,
      rules: creation.rules,
      bypassActors: creation.bypass_actors,
    };
    await expect(verifyStandingJournalRules(publisher, expected)).resolves.toBe(
      false,
    );
    await expect(
      verifyStandingJournalRules(
        {
          ...publisher,
          readStandingRulesetObservation: async () => ({
            ...observation,
            updatedAt: "stale",
          }),
        },
        expected,
      ),
    ).resolves.toBe(false);
    await expect(
      verifyStandingJournalRules(
        {
          ...publisher,
          readStandingRulesetObservation: async () => observation,
        },
        expected,
      ),
    ).resolves.toBe(true);
  });

  it("fails closed when GitHub cannot return either ruleset", async () => {
    const publisher = reader();
    publisher.fetchImpl.mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );
    await expect(verifyStandingJournalRules(publisher, expected)).resolves.toBe(
      false,
    );
  });
});
