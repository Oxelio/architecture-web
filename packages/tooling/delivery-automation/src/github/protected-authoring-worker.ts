import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import { sameWorkIntegrationCandidate } from "../control/work-integration-request.js";
import { createAuthoringOperationResolver } from "./authoring-operation-resolver.js";
import { createGitHubWorkReservationJournal } from "./github-work-reservation-journal.js";
import { executeReservedGitHubWorkIntegration } from "./reserved-work-integration.js";
import { runProtectedAuthoringJob } from "./run-protected-authoring-job.js";

type Integration = Parameters<typeof executeReservedGitHubWorkIntegration>[0];
type Job = Parameters<typeof runProtectedAuthoringJob>[0];
type Resolver = Parameters<typeof createAuthoringOperationResolver>[0];

// Assemble the protected worker from existing owners. The workflow must
// supply verified activation, Role authority and separately scoped credentials.
export function createProtectedAuthoringWorker(input: {
  readonly enabled?: boolean;
  readonly resolver: Resolver;
  readonly integration: Integration["scope"];
  readonly verifyBoundary: () => Promise<boolean>;
  readonly authorizeCancellation: (
    request: PreparedAuthoringRequest,
    resolution: Parameters<Integration["authorize"]>[0],
  ) => Promise<boolean>;
  readonly authorizeRecovery: () => Promise<boolean>;
}) {
  if (input.enabled !== true) {
    return async () => "inactive" as const;
  }
  const { publisher, checksToken } = input.integration;
  const { authoringToken, readToken, projectsReadToken, projectsWriteToken } =
    input.resolver;
  const writerTokens = [
    publisher.mergeToken,
    checksToken,
    authoringToken,
    projectsWriteToken,
  ];
  if (
    writerTokens.some(
      (token) =>
        !token.trim() || token === readToken || token === projectsReadToken,
    ) ||
    new Set(writerTokens).size !== writerTokens.length
  ) {
    throw new Error("AUTHORING_CREDENTIAL_SEPARATION_UNVERIFIED");
  }
  const journal = createGitHubWorkReservationJournal({
    repositoryToken: publisher.mergeToken,
    ...(publisher.fetchImpl ? { fetchImpl: publisher.fetchImpl } : {}),
  });
  const resolve = createAuthoringOperationResolver(input.resolver);
  return (job: Omit<Job, "enabled" | "ports" | "journalReader">) =>
    runProtectedAuthoringJob({
      ...job,
      enabled: true,
      journalReader: journal,
      ports: {
        journal,
        resolve,
        verifyBoundary: input.verifyBoundary,
        authorizeRecovery: input.authorizeRecovery,
        async cancelOrResolve(boundary, request, authorizeWrite) {
          const candidate = boundary.reservation?.reservation.candidate;
          if (!candidate) {
            return;
          }
          await executeReservedGitHubWorkIntegration({
            candidate,
            operation: "resolve",
            scope: input.integration,
            authorize: async (resolution) =>
              resolution.operation === "resolve" &&
              sameWorkIntegrationCandidate(candidate, resolution.candidate) &&
              (await authorizeWrite()) &&
              input.authorizeCancellation(request, resolution),
          });
        },
      },
    });
}
