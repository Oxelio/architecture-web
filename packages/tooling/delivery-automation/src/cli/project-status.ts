import { isDeepStrictEqual } from "node:util";

import { resolveActivationContext } from "../config/activation-context.js";
import { isWorkIntegrationCandidate } from "../control/work-integration-request.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import { canRecordWorkCompletion } from "../github/github-work-reservation-journal.js";
import {
  authenticateProjectStatusCommand,
  type ProjectStatusCommand,
  type ProjectStatusComment,
} from "../github/project-status-command.js";
import { runCoordinatedStatusWrite } from "../github/run-coordinated-status-write.js";
import {
  matchesStandingControllerBoundary,
  type StandingControllerBoundary,
} from "../github/standing-controller-boundary.js";
import { isStandingDelegationRevoked } from "../github/standing-delegation-revocation.js";
import { verifyStandingJournalRules } from "../github/work-merge-publisher.js";
import { createCoordinatedProjectStatusWriter } from "../github/work-status-writer.js";
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

interface TransitionEvidenceRule {
  readonly kind: string;
  readonly actorId: number;
  readonly appId: number | null;
}

interface StatusChannel {
  readonly mode: "standing" | "supervised";
  readonly workNumbers?: readonly number[];
  readonly transitions: readonly {
    readonly from: ProjectStatusCommand["from"];
    readonly to: ProjectStatusCommand["to"];
    readonly requirements: readonly TransitionEvidenceRule[];
  }[];
}

interface SourceEntry {
  readonly name: string;
  readonly sha: string;
}

const repository = "Oxelio/architecture-web";
const repositoryId = 1336937640;
const trustedWorkflowRef = `${repository}/.github/workflows/delivery-project-status.yml@refs/heads/main`;

async function main() {
  if (process.env["DELIVERY_PROJECT_STATUS_COMMANDS_ENABLED"] !== "true") {
    return "inactive";
  }
  requireTrustedMain("issue_comment", "workflow_dispatch");
  if (process.env["GITHUB_WORKFLOW_REF"] !== trustedWorkflowRef) {
    return "denied";
  }

  const commentId = positiveInteger("STATUS_COMMAND_COMMENT_ID");
  const workNumber = positiveInteger("STATUS_COMMAND_WORK_NUMBER");
  const recoveryOnly = process.env["GITHUB_EVENT_NAME"] === "workflow_dispatch";
  const readComment = () =>
    githubRepositoryRequest<ProjectStatusComment>(
      `/issues/comments/${commentId}`,
    );
  const actorId = recoveryOnly
    ? (await readComment()).user.id
    : positiveInteger("GITHUB_ACTOR_ID");
  const recoveryRecordId = recoveryOnly
    ? positiveInteger("STATUS_RECOVERY_COMMENT_ID")
    : null;
  const recoveryAuthorized = async () => {
    if (!recoveryRecordId) {
      return false;
    }
    const record = await readDirectMaintainerRecord<{
      kind?: string;
      repositoryId?: number;
      projectNumber?: number;
      workNumber?: number;
      commentId?: number;
      expiresAt?: string;
    }>(recoveryRecordId, 115);
    return (
      record?.kind === "recover-project-status" &&
      record.repositoryId === repositoryId &&
      record.projectNumber === 3 &&
      record.workNumber === workNumber &&
      record.commentId === commentId &&
      Date.parse(record.expiresAt ?? "") > Date.now()
    );
  };
  const authorityId = positiveInteger(
    "DELIVERY_PROJECT_STATUS_CHANNEL_COMMENT_ID",
  );
  const mode =
    process.env["DELIVERY_STANDING_EXECUTION_ENABLED"] === "true"
      ? "standing"
      : "supervised";
  const readPolicy = (id: number) =>
    readDirectMaintainerRecord<StatusChannel>(id, 115);
  const readCommand = (id: number, recovery: boolean) =>
    authenticateProjectStatusCommand({
      workNumber,
      commentId,
      actorId,
      now: recovery ? () => Number.NEGATIVE_INFINITY : Date.now,
      readComment,
      readChannelPolicy: () => readPolicy(id),
    });
  const delegationCommentId = positiveInteger(
    "DELIVERY_STANDING_DELEGATION_COMMENT_ID",
  );
  const repositoryToken = requiredEnvironment("GITHUB_TOKEN");
  const readAuthorization = async () => {
    const command = await readCommand(authorityId, false);
    const policy = await readPolicy(authorityId);
    if (
      !command ||
      policy?.mode !== mode ||
      (mode === "supervised" &&
        (!Array.isArray(policy.workNumbers) ||
          !policy.workNumbers.includes(workNumber))) ||
      !(await verifyTransitionEvidence(command, policy)) ||
      (await isStandingDelegationRevoked({
        repositoryToken,
        delegationCommentId,
      }))
    ) {
      return null;
    }
    return { command, authorityId };
  };

  const preflight = recoveryOnly
    ? await recoveryAuthorized()
    : await readAuthorization();
  if (process.env["STATUS_COMMAND_INTAKE_ONLY"] === "true") {
    return preflight ? "eligible" : "denied";
  }

  const workflowSha = requiredEnvironment("TRUSTED_WORKFLOW_SHA");
  const projectsReadToken = requiredEnvironment(
    "DELIVERY_OBSERVATION_PROJECTS_TOKEN",
  );
  const projectsWriteToken = requiredEnvironment(
    "DELIVERY_PROJECT_STATUS_WRITE_TOKEN",
  );
  const controllerToken = requiredEnvironment("CONTROLLER_INSTALLATION_TOKEN");
  const [installation, inventory, root, tooling, manifest, boundary] =
    await Promise.all([
      verifyControllerInstallation({
        token: controllerToken,
        appSlug: requiredEnvironment("CONTROLLER_APP_SLUG"),
        expectedAppSlug: "architecture-web-work-controller",
        installationId: positiveInteger("CONTROLLER_INSTALLATION_ID"),
        expectedInstallationId: positiveInteger(
          "EXPECTED_CONTROLLER_INSTALLATION_ID",
        ),
      }),
      readGitHubInventory({
        repository,
        repositoryToken,
        projectsToken: projectsReadToken,
      }),
      githubRepositoryRequest<SourceEntry[]>(`/contents?ref=${workflowSha}`),
      githubRepositoryRequest<SourceEntry[]>(
        `/contents/packages/tooling?ref=${workflowSha}`,
      ),
      readActivationManifest(),
      readBoundary(mode),
    ]);
  const owner = resolveActivationContext({ repository, inventory, manifest });
  if (
    !installation ||
    owner.status !== "ready" ||
    !owner.activation.workState ||
    !owner.activation.dependencies ||
    !boundary ||
    !preflight
  ) {
    return "denied";
  }
  const candidate = boundary.candidate;
  if (mode === "supervised" && !isWorkIntegrationCandidate(candidate)) {
    return "denied";
  }
  const expected = {
    repositoryId,
    projectId: owner.project.id,
    controllerInstallationId: installation.installationId,
    checksInstallationId: 178883123,
    sources: {
      ".github": root.find(({ name }) => name === ".github")?.sha ?? "",
      "pnpm-lock.yaml":
        root.find(({ name }) => name === "pnpm-lock.yaml")?.sha ?? "",
      "packages/tooling/delivery-automation":
        tooling.find(({ name }) => name === "delivery-automation")?.sha ?? "",
    },
  };
  if (
    !matchesStandingControllerBoundary(boundary, expected, {
      mode,
      ...(candidate ? { candidate } : {}),
      now: Date.now(),
      requireWriterExclusion: true,
    })
  ) {
    return "denied";
  }

  const writer = createCoordinatedProjectStatusWriter({
    projectId: expected.projectId,
    repositoryToken,
    controllerToken,
    projectsReadToken,
    projectsWriteToken,
  });
  if (!writer) {
    return "denied";
  }

  const verifyBoundary = async () =>
    isDeepStrictEqual(boundary, await readBoundary(mode)) &&
    (mode !== "supervised" ||
      Date.parse(boundary.expiresAt ?? "") > Date.now()) &&
    (
      await githubRepositoryRequest<{ commit: { sha: string } }>(
        "/branches/main",
      )
    ).commit.sha === workflowSha &&
    (await verifyStandingJournalRules(
      {
        repository,
        repositoryId,
        repositoryToken,
        readStandingRulesetObservation: async (id) => {
          const observations = boundary.rulesetObservations.filter(
            ({ rulesetId }) => rulesetId === id,
          );
          return observations.length === 1 ? (observations[0] ?? null) : null;
        },
      },
      {
        creationRulesetId: boundary.journalCreationRulesetId,
        immutabilityRulesetId: boundary.journalImmutabilityRulesetId,
        controllerAppId: 5781545,
      },
    ));

  return runCoordinatedStatusWrite({
    enabled: true,
    recoveryOnly,
    commentId,
    workflowSha,
    controllerToken,
    readAuthorization,
    readRecoveryAuthorization: async (id) => {
      if (!(await recoveryAuthorized())) {
        return null;
      }
      const command = await readCommand(id, true);
      return command ? { command, authorityId: id } : null;
    },
    verifyBoundary,
    // The shared protected queue serializes this guard with other writers.
    // An affected reservation must settle before the retry can write.
    mayWriteWithReservation: (_reservation, target) =>
      canRecordWorkCompletion({ repositoryToken }, target),
    ...writer,
  });
}

function readBoundary(mode: "standing" | "supervised") {
  return readMaintainerRecord<StandingControllerBoundary>(
    mode === "standing"
      ? "DELIVERY_STANDING_BOUNDARY_COMMENT_ID"
      : "DELIVERY_STANDING_VALIDATION_COMMENT_ID",
    115,
  );
}

async function verifyTransitionEvidence(
  command: ProjectStatusCommand,
  policy: StatusChannel,
): Promise<boolean> {
  if (!Array.isArray(policy.transitions)) {
    return false;
  }
  const transitions = policy.transitions.filter(
    (transition) =>
      transition?.from === command.from && transition.to === command.to,
  );
  const requirements = transitions[0]?.requirements;
  if (
    transitions.length !== 1 ||
    !Array.isArray(requirements) ||
    requirements.length !== command.evidenceCommentIds.length ||
    (command.to === "Ready" &&
      !requirements.some(
        (rule: TransitionEvidenceRule) => rule?.kind === "readiness",
      ))
  ) {
    return false;
  }
  const evidence = await Promise.all(
    command.evidenceCommentIds.map(async (id) => {
      const comment = await githubRepositoryRequest<ProjectStatusComment>(
        `/issues/comments/${id}`,
      );
      if (
        comment.id !== id ||
        comment.issue_url !==
          `https://api.github.com/repos/${repository}/issues/${command.workNumber}` ||
        !comment.created_at ||
        comment.created_at !== comment.updated_at ||
        (Number.isNaN(Date.parse(comment.created_at)) ||
          Number.isNaN(Date.parse(command.statusUpdatedAt)) ||
          Date.parse(comment.created_at) <= Date.parse(command.statusUpdatedAt)) ||
        comment.body.length > 4096
      ) {
        return null;
      }
      const record = JSON.parse(comment.body) as Record<string, unknown> | null;
      const issuerApp = comment.performed_via_github_app;
      if (
        record?.["decision"] !== "accepted" ||
        record["workNumber"] !== command.workNumber ||
        record["from"] !== command.from ||
        record["to"] !== command.to ||
        record["statusUpdatedAt"] !== command.statusUpdatedAt ||
        typeof record["kind"] !== "string" ||
        issuerApp === undefined
      ) {
        return null;
      }
      return {
        kind: record["kind"],
        actorId: comment.user.id,
        appId: issuerApp?.id ?? null,
      };
    }),
  );
  return (
    new Set(requirements.map((entry: TransitionEvidenceRule) => entry?.kind))
      .size === requirements.length &&
    requirements.every(
      (required: TransitionEvidenceRule) =>
        typeof required?.kind === "string" &&
        evidence.some(
          (actual) =>
            actual?.kind === required.kind &&
            actual.actorId === required.actorId &&
            actual.appId === required.appId,
        ),
    )
  );
}

try {
  writeJson({ status: await main() });
} catch {
  writeJson({ status: "denied" });
  process.exitCode = 1;
}
