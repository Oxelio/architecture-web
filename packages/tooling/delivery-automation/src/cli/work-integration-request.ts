import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { resolveActivationContext } from "../config/activation-context.js";
import { readStandingDelegation } from "../control/standing-delegation.js";
import { readStandingIntegrationWakeup } from "../control/standing-integration-wakeup.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import {
  authenticateDirectSquashRequest,
  type DirectSquashEvent,
} from "../github/direct-squash-request.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import { runStandingWorkIntegration } from "../github/run-standing-work-integration.js";
import {
  matchesStandingControllerBoundary,
  type StandingControllerBoundary,
} from "../github/standing-controller-boundary.js";
import { isStandingDelegationRevoked } from "../github/standing-delegation-revocation.js";
import { readStandingWorkFacts } from "../github/standing-work-eligibility.js";
import { readAuthorizedWorkIntegrationTarget } from "../github/work-integration-target.js";
import type { MergeCandidate } from "../github/work-merge-publisher.js";
import {
  positiveInteger,
  readActivationManifest,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
  readMaintainerRecord,
  requireTrustedMain,
} from "./work-pilot-support.js";

requireTrustedMain("issue_comment", "workflow_run");
const event: unknown = JSON.parse(
  await readFile(requiredEnvironment("GITHUB_EVENT_PATH"), "utf8"),
);
if (process.env["GITHUB_EVENT_NAME"] === "workflow_run") {
  writeJson(await handleStandingWakeup(event));
} else {
  const outcome = await authenticateDirectSquashRequest({
    event: event as DirectSquashEvent,
    ref: requiredEnvironment("GITHUB_REF"),
    runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
    actorId: positiveInteger("GITHUB_ACTOR_ID"),
    now: Date.now(),
    readComment: (id) => githubRepositoryRequest(`/issues/comments/${id}`),
    readCandidate: (number) => githubRepositoryRequest(`/pulls/${number}`),
    readGrant: () =>
      readMaintainerRecord("DELIVERY_DIRECT_GRANT_COMMENT_ID", 91),
    workOwnsCandidate,
  });
  writeJson(outcome);
  if (outcome.status === "blocked") {
    process.exitCode = 2;
  }
}

async function handleStandingWakeup(event: unknown) {
  const executing =
    process.env["DELIVERY_STANDING_EXECUTION_ENABLED"] === "true" ||
    !!process.env["DELIVERY_STANDING_VALIDATION_COMMENT_ID"];
  if (
    !executing &&
    process.env["DELIVERY_STANDING_REQUESTS_ENABLED"] !== "true"
  ) {
    return { status: "inactive" };
  }
  const result = await readStandingIntegrationWakeup({
    event: event as Parameters<
      typeof readStandingIntegrationWakeup
    >[0]["event"],
    trustedMainSha: requiredEnvironment("TRUSTED_WORKFLOW_SHA"),
    readPull: (number) => githubRepositoryRequest(`/pulls/${number}`),
    ownsCandidate: workOwnsCandidate,
  });
  if (result.status !== "selected") {
    return result;
  }
  if (executing) {
    return executeStandingCandidate(result.candidate);
  }
  return observeStandingCandidate(result);
}

async function observeStandingCandidate(
  result: Extract<
    Awaited<ReturnType<typeof readStandingIntegrationWakeup>>,
    { status: "selected" }
  >,
) {
  const controllerBot = process.env["DELIVERY_STANDING_CONTROLLER_BOT_ID"];
  const delegation = await readStandingDelegation({
    context: {
      repository: requiredEnvironment("GITHUB_REPOSITORY"),
      repositoryId: positiveInteger("GITHUB_REPOSITORY_ID"),
      ref: requiredEnvironment("GITHUB_REF"),
      runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
      workflowSha: requiredEnvironment("TRUSTED_WORKFLOW_SHA"),
    },
    controllerBotId:
      controllerBot && /^\d+$/u.test(controllerBot) ? Number(controllerBot) : 0,
    now: Date.now(),
    readMaintainerRecord: () =>
      readMaintainerRecord("DELIVERY_STANDING_DELEGATION_COMMENT_ID", 115),
  });
  if (!delegation?.gatePublication || !delegation.nativeSquash) {
    return { status: "denied", reason: "STANDING_DELEGATION_UNVERIFIED" };
  }
  const repository = requiredEnvironment("GITHUB_REPOSITORY");
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  try {
    if (
      await isStandingDelegationRevoked({
        repositoryToken,
        delegationCommentId: positiveInteger(
          "DELIVERY_STANDING_DELEGATION_COMMENT_ID",
        ),
      })
    ) {
      return { status: "denied", reason: "STANDING_DELEGATION_REVOKED" };
    }
  } catch {
    return { status: "denied", reason: "STANDING_REVOCATION_STATE_UNVERIFIED" };
  }
  const projectsToken =
    process.env["DELIVERY_OBSERVATION_PROJECTS_TOKEN"]?.trim();
  if (!projectsToken) {
    return { status: "denied", reason: "PROJECT_READER_UNAVAILABLE" };
  }

  const manifest = await readActivationManifest();
  const inventory = await readGitHubInventory({
    repository,
    projectsToken,
    repositoryToken,
  });
  const activation = resolveActivationContext({
    repository,
    manifest,
    inventory,
  });
  if (activation.status === "blocked") {
    return {
      status: "denied",
      reason: "PROJECT_OPERATIONAL_OWNER_UNAVAILABLE",
    };
  }

  const facts = await readStandingWorkFacts(
    {
      repository,
      repositoryToken,
      projectsToken,
      projectId: activation.project.id,
      manifest,
    },
    result.candidate,
  );
  if (!facts) {
    return { status: "denied", reason: "STANDING_CANDIDATE_FACTS_UNVERIFIED" };
  }

  // The Code Review can bind its assessment to this digest. The selection and
  // observed facts do not establish that the candidate passed the Work Merge Gate.
  return {
    status: "observed",
    candidate: result.candidate,
    validationRunId: result.validationRunId,
    workType: facts.workType,
    workflowDepth: facts.workflowDepth,
    characteristics: facts.characteristics,
    changedPaths: facts.changedPaths,
    factsDigest: facts.digest,
  };
}

async function executeStandingCandidate(candidate: MergeCandidate) {
  if (
    requiredEnvironment("GITHUB_WORKFLOW_REF") !==
    "Oxelio/architecture-web/.github/workflows/delivery-work-integration-request.yml@refs/heads/main"
  ) {
    return { status: "denied", reason: "STANDING_WORKFLOW_UNVERIFIED" };
  }

  const context = {
    repository: requiredEnvironment("GITHUB_REPOSITORY"),
    repositoryId: positiveInteger("GITHUB_REPOSITORY_ID"),
    ref: requiredEnvironment("GITHUB_REF"),
    runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
    workflowSha: requiredEnvironment("TRUSTED_WORKFLOW_SHA"),
  };
  const delegationCommentId = positiveInteger(
    "DELIVERY_STANDING_DELEGATION_COMMENT_ID",
  );
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const mergeToken = requiredEnvironment("CONTROLLER_INSTALLATION_TOKEN");
  const checksToken = requiredEnvironment("GATE_APP_TOKEN");
  const projectsToken = requiredEnvironment(
    "DELIVERY_OBSERVATION_PROJECTS_TOKEN",
  );
  const checksInstallationId = positiveInteger("GATE_INSTALLATION_ID");
  const manifest = await readActivationManifest();
  const [installation, inventory, top, tooling] = await Promise.all([
    verifyControllerInstallation({
      token: mergeToken,
      appSlug: requiredEnvironment("CONTROLLER_APP_SLUG"),
      expectedAppSlug: "architecture-web-work-controller",
      installationId: positiveInteger("CONTROLLER_INSTALLATION_ID"),
      expectedInstallationId: positiveInteger(
        "EXPECTED_CONTROLLER_INSTALLATION_ID",
      ),
    }),
    readGitHubInventory({
      repository: context.repository,
      repositoryToken,
      projectsToken,
    }),
    githubRepositoryRequest<SourceEntry[]>(
      `/contents?ref=${context.workflowSha}`,
    ),
    githubRepositoryRequest<SourceEntry[]>(
      `/contents/packages/tooling?ref=${context.workflowSha}`,
    ),
  ]);
  const owner = resolveActivationContext({
    repository: context.repository,
    manifest,
    inventory,
  });
  if (
    !installation ||
    owner.status !== "ready" ||
    checksInstallationId !== 178883123 ||
    new Set([repositoryToken, mergeToken, checksToken, projectsToken]).size !==
      4
  ) {
    return { status: "denied", reason: "STANDING_IDENTITIES_UNVERIFIED" };
  }

  const sources = {
    ".github": top.find(({ name }) => name === ".github")?.sha ?? "",
    "pnpm-lock.yaml":
      top.find(({ name }) => name === "pnpm-lock.yaml")?.sha ?? "",
    "packages/tooling/delivery-automation":
      tooling.find(({ name }) => name === "delivery-automation")?.sha ?? "",
  };
  const expected = {
    repositoryId: context.repositoryId,
    projectId: owner.project.id,
    controllerInstallationId: installation.installationId,
    checksInstallationId,
    sources,
  };
  const mode =
    process.env["DELIVERY_STANDING_EXECUTION_ENABLED"] === "true"
      ? "standing"
      : "supervised";
  const readBoundary = async () => {
    const record = await readMaintainerRecord<StandingControllerBoundary>(
      mode === "standing"
        ? "DELIVERY_STANDING_BOUNDARY_COMMENT_ID"
        : "DELIVERY_STANDING_VALIDATION_COMMENT_ID",
      115,
    );
    return matchesStandingControllerBoundary(record, expected, {
      mode,
      candidate,
      now: Date.now(),
    })
      ? record
      : null;
  };
  const boundary = await readBoundary();
  if (!boundary) {
    return { status: "denied", reason: "STANDING_WRITER_BOUNDARY_UNVERIFIED" };
  }
  const rules = async (rulesetId: number) => {
    const records = (await readBoundary())?.rulesetObservations.filter(
      (record) => record.rulesetId === rulesetId,
    );
    return records?.length === 1 ? (records[0] ?? null) : null;
  };
  // Both this job and the ordinary revocation job run in
  // delivery-work-controller-protected. Positive recovery uses separate
  // authority and never reissues a mutation from the journal.
  const boundaryIsCurrent = async () =>
    isDeepStrictEqual(boundary, await readBoundary()) &&
    (
      await githubRepositoryRequest<{
        readonly commit: { readonly sha: string };
      }>("/branches/main")
    ).commit.sha === context.workflowSha;
  return runStandingWorkIntegration({
    candidate,
    context,
    standingEnabled: true,
    journalRules: {
      creationRulesetId: boundary.journalCreationRulesetId,
      immutabilityRulesetId: boundary.journalImmutabilityRulesetId,
      controllerAppId: 5781545,
    },
    eligibilityReader: {
      repository: context.repository,
      repositoryToken,
      projectId: owner.project.id,
      projectsToken,
      manifest,
    },
    scope: {
      controllerBotId: installation.botId,
      checksAppId: 5625775,
      checksToken,
      cancellationRulesetId: boundary.mergeRulesetId,
      withinFinalReleaseAuthority: async (action) =>
        (await boundaryIsCurrent()) ? action() : null,
      publisher: {
        repository: context.repository,
        repositoryId: context.repositoryId,
        actorId: installation.botId,
        projectId: owner.project.id,
        projectsToken,
        repositoryToken,
        mergeToken,
        activation: owner.activation,
        readStandingRulesetObservation: rules,
        withinVerifiedBoundary: async (_target, _mode, action) =>
          (await boundaryIsCurrent()) ? action() : null,
      },
    },
    readEvidenceAuthority: async () =>
      (await readBoundary())?.evidenceAuthority ?? null,
    readDelegation: async () => {
      const delegation = await readStandingDelegation({
        context,
        controllerBotId: installation.botId,
        now: Date.now(),
        readMaintainerRecord: () =>
          readDirectMaintainerRecord(delegationCommentId, 115),
      });
      const current = await readBoundary();
      if (!delegation || !isDeepStrictEqual(boundary, current)) {
        return null;
      }
      const expiresAt =
        mode === "supervised"
          ? new Date(
              Math.min(
                Date.parse(delegation.expiresAt),
                Date.parse(boundary.expiresAt ?? ""),
              ),
            ).toISOString()
          : delegation.expiresAt;
      return {
        ...delegation,
        expiresAt,
        decisionCommentId: delegationCommentId,
      };
    },
    authorizeRecovery: boundaryIsCurrent,
  });
}

interface SourceEntry {
  readonly name: string;
  readonly sha: string;
}

async function workOwnsCandidate(candidate: MergeCandidate): Promise<boolean> {
  const manifest = await readActivationManifest();
  const [target, main] = await Promise.all([
    readAuthorizedWorkIntegrationTarget({
      repository: "Oxelio/architecture-web",
      workNumber: candidate.workNumber,
      repositoryToken: requiredEnvironment("GITHUB_TOKEN"),
      active: manifest.mappings.workIntegrationPr.status === "verified",
    }),
    githubRepositoryRequest<{ readonly commit: { readonly sha: string } }>(
      "/branches/main",
    ),
  ]);
  return (
    target.status === "selected" &&
    target.target.pullRequestNumber === candidate.pullNumber &&
    target.target.headSha === candidate.headSha &&
    main.commit.sha === candidate.baseSha
  );
}
