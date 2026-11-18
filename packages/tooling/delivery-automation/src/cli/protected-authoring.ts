import { isDeepStrictEqual } from "node:util";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import { createAuthoringControlVerifier } from "../github/authoring-control-revision.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import { readProjectWorkItems } from "../github/github-operational-state.js";
import {
  authenticateProjectStatusCommand,
  type ProjectStatusComment,
} from "../github/project-status-command.js";
import {
  type StatusChannel,
  verifyTransitionEvidence,
} from "../github/project-status-evidence.js";
import {
  createProtectedAuthoringAuthority,
  type ProtectedAuthoringChannel,
  protectedAuthoringChannelSchema,
} from "../github/protected-authoring-authority.js";
import { createProtectedAuthoringWorker } from "../github/protected-authoring-worker.js";
import { createCoordinatedProjectStatusWriter } from "../github/work-status-writer.js";
import {
  positiveInteger,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";
import {
  protectedProjectId,
  readActionsOidcToken,
  readProtectedRuntime,
  requireProtectedDispatch,
} from "./protected-runtime.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
} from "./work-pilot-support.js";

async function statusCommand(
  channel: ProtectedAuthoringChannel,
  request: PreparedAuthoringRequest,
) {
  const applicable = channel.permissions.filter(
    (grant) =>
      grant.actorDigest === request.actorDigest &&
      grant.workNumber === request.workNumber &&
      grant.commandDigests.includes(request.commandDigest) &&
      grant.statusCommandCommentId !== undefined,
  );
  const id =
    applicable.length === 1 ? applicable[0]?.statusCommandCommentId : null;
  if (!id) {
    return null;
  }
  const policy = await readDirectMaintainerRecord<
    StatusChannel & { actorId: number }
  >(positiveInteger("DELIVERY_PROJECT_STATUS_CHANNEL_COMMENT_ID"), 115);
  if (!policy || policy.mode !== "standing") {
    return null;
  }
  const readComment = (commentId: number) =>
    githubRepositoryRequest<ProjectStatusComment>(
      `/issues/comments/${commentId}`,
    );
  const command = await authenticateProjectStatusCommand({
    workNumber: request.workNumber,
    commentId: id,
    actorId: policy.actorId,
    now: Date.now,
    readComment: () => readComment(id),
    readChannelPolicy: async () => policy,
  });
  return command &&
    (await verifyTransitionEvidence(command, policy, readComment))
    ? command
    : null;
}

async function main() {
  if (process.env["DELIVERY_AUTHORING_ENABLED"] !== "true") {
    return "inactive";
  }
  requireProtectedDispatch("delivery-authoring.yml");
  const channelId = positiveInteger("DELIVERY_AUTHORING_CHANNEL_COMMENT_ID");
  const readChannel = async () => {
    const result = protectedAuthoringChannelSchema.safeParse(
      await readDirectMaintainerRecord(channelId, 140),
    );
    return result.success && Date.parse(result.data.expiresAt) > Date.now()
      ? result.data
      : null;
  };
  const channel = await readChannel();
  if (
    !channel ||
    channel.dispatchActorId !== positiveInteger("GITHUB_ACTOR_ID")
  ) {
    return "denied";
  }
  const origin = new URL(channel.intakeOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== channel.intakeOrigin ||
    channel.intakeOrigin !==
      requiredEnvironment("DELIVERY_AUTHORING_INTAKE_ORIGIN")
  ) {
    return "denied";
  }
  if (process.env["AUTHORING_PROJECT_CONTEXT"] === "true") {
    return publishProjectContext(channel, readChannel);
  }
  const runtime = await readProtectedRuntime(channel.approvedControlRevision);
  if (!runtime) {
    return "denied";
  }
  const authoringToken = requiredEnvironment("DELIVERY_AUTHORING_TOKEN");
  const authoringSlug = requiredEnvironment("DELIVERY_AUTHORING_APP_SLUG");
  const authoringInstallation = await verifyControllerInstallation({
    token: authoringToken,
    appSlug: authoringSlug,
    expectedAppSlug: requiredEnvironment("EXPECTED_AUTHORING_APP_SLUG"),
    installationId: positiveInteger("DELIVERY_AUTHORING_INSTALLATION_ID"),
    expectedInstallationId: channel.authoringInstallationId,
    expectedAppId: channel.authoringAppId,
  });
  if (
    !authoringInstallation ||
    authoringInstallation.botId !== channel.authoringBotId ||
    authoringInstallation.botId === runtime.actorId ||
    positiveInteger("GATE_INSTALLATION_ID") !==
      runtime.boundary.checksInstallationId
  ) {
    return "denied";
  }
  const projectsWriteToken = requiredEnvironment(
    "DELIVERY_PROJECT_STATUS_WRITE_TOKEN",
  );
  const statusFieldId = requiredEnvironment("DELIVERY_PROJECT_STATUS_FIELD_ID");
  const writer = createCoordinatedProjectStatusWriter({
    projectId: protectedProjectId,
    projectsReadToken: runtime.projectsToken,
    projectsWriteToken,
    repositoryToken: runtime.repositoryToken,
    controllerToken: runtime.mergeToken,
  });
  if (!writer) {
    return "denied";
  }
  const verifyBoundary = async () =>
    isDeepStrictEqual(channel, await readChannel()) && runtime.verify();
  const readOwnerBinding = createProtectedAuthoringAuthority({
    readChannel,
    statusFieldId,
    readStatusCommand: (request) => statusCommand(channel, request),
  });
  const worker = createProtectedAuthoringWorker({
    enabled: true,
    verifyBoundary,
    authorizeCancellation: verifyBoundary,
    authorizeRecovery: verifyBoundary,
    integration: {
      publisher: {
        repository: runtime.repository,
        repositoryId: runtime.repositoryId,
        actorId: runtime.actorId,
        projectId: protectedProjectId,
        projectsToken: runtime.projectsToken,
        repositoryToken: runtime.repositoryToken,
        mergeToken: runtime.mergeToken,
        activation: runtime.activation,
        readGrant: async () => null,
        readStandingRulesetObservation: runtime.readStandingRulesetObservation,
        withinVerifiedBoundary: async (_candidate, _mode, action) =>
          (await verifyBoundary()) ? action() : null,
      },
      controllerBotId: runtime.actorId,
      checksAppId: 5625775,
      checksToken: requiredEnvironment("GATE_APP_TOKEN"),
      cancellationRulesetId: runtime.boundary.mergeRulesetId,
    },
    resolver: {
      authoringAppId: channel.authoringAppId,
      authoringBotId: authoringInstallation.botId,
      readToken: runtime.repositoryToken,
      authoringToken,
      projectsReadToken: runtime.projectsToken,
      projectsWriteToken,
      statusFieldId,
      statusWriter: writer,
      readOwnerBinding,
      stagingDirectory: requiredEnvironment("RUNNER_TEMP"),
      maximumCommits: 150,
      maximumRelatedIssues: 100,
    },
  });
  return worker({
    intakeOrigin: channel.intakeOrigin,
    workflowSha: runtime.workflowSha,
    requestId: requiredEnvironment("AUTHORING_REQUEST_ID"),
    expectedPayloadDigest: requiredEnvironment("AUTHORING_PAYLOAD_DIGEST"),
    maximumExchangeBytes: positiveInteger(
      "DELIVERY_AUTHORING_MAXIMUM_EXCHANGE_BYTES",
    ),
    maximumHistoryRevisions: positiveInteger(
      "DELIVERY_AUTHORING_MAXIMUM_HISTORY_REVISIONS",
    ),
    getJobToken: () => readActionsOidcToken(channel.intakeOrigin),
  });
}

async function publishProjectContext(
  channel: ProtectedAuthoringChannel,
  readChannel: () => Promise<ProtectedAuthoringChannel | null>,
) {
  const verifyControl = createAuthoringControlVerifier({
    approvedRevision: channel.approvedControlRevision,
    readToken: requiredEnvironment("GITHUB_TOKEN"),
  });
  if (!(await verifyControl(requiredEnvironment("TRUSTED_WORKFLOW_SHA")))) {
    return "denied";
  }
  const works = await readProjectWorkItems({
    repository: "Oxelio/architecture-web",
    projectId: protectedProjectId,
    projectsToken: requiredEnvironment("DELIVERY_OBSERVATION_PROJECTS_TOKEN"),
  });
  if (!isDeepStrictEqual(channel, await readChannel())) {
    return "denied";
  }
  const response = await fetch(`${channel.intakeOrigin}/jobs/project-context`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await readActionsOidcToken(channel.intakeOrigin)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generatedAt: Date.now(),
      works: works.map(({ issueNumber, issueOpen, fields }) => ({
        workNumber: issueNumber,
        issueOpen,
        status: fields["Status"] ?? null,
        workType: fields["Work Type"] ?? null,
        workflowDepth: fields["Workflow Depth"] ?? null,
      })),
    }),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  return response.status === 200 ? "recorded" : "deferred";
}

try {
  writeJson({ status: await main() });
} catch {
  writeJson({ status: "denied" });
  process.exitCode = 1;
}
