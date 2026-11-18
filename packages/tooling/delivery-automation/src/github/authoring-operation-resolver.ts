import { isDeepStrictEqual } from "node:util";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import { resolveAuthoringCreationOperation } from "./authoring-creation-operation.js";
import { resolveAuthoringFactsOperation } from "./authoring-facts-operation.js";
import { resolveAuthoringMetadataOperation } from "./authoring-metadata-operation.js";
import { readAuthoringOwnerScope } from "./authoring-owner-scope.js";
import { resolveAuthoringProjectFieldOperation } from "./authoring-project-field-operation.js";
import { resolveAuthoringStatusOperation } from "./authoring-status-operation.js";
import type {
  AuthoringExecutionPorts,
  ResolvedAuthoringOperation,
} from "./controlled-authoring-execution.js";
import {
  type AuthoringGitInventory,
  resolveGitAuthoringOperation,
} from "./git-authoring-operation.js";
import type { FetchLike } from "./github-project-inventory.js";
import type { ProjectStatusCommand } from "./project-status-command.js";
import type { createCoordinatedProjectStatusWriter } from "./work-status-writer.js";

type Boundary = Parameters<AuthoringExecutionPorts["resolve"]>[2];
type StatusWriter = NonNullable<
  ReturnType<typeof createCoordinatedProjectStatusWriter>
>;

export interface AuthoringOwnerBinding {
  readonly authorityDigest: string;
  readonly readAuthority: () => Promise<string | null>;
  readonly sourceBaseSha?: string;
  readonly allowNonFastForward?: boolean;
  readonly verifyGitInventory?: (
    inventory: AuthoringGitInventory,
  ) => Promise<boolean>;
  readonly authenticatedStatus?: ProjectStatusCommand;
  readonly readPriorityAuthority?: () => Promise<string | null>;
}

interface ResolverConfiguration {
  readonly readToken: string;
  readonly authoringToken: string;
  readonly projectsReadToken: string;
  readonly projectsWriteToken: string;
  readonly statusFieldId: string;
  readonly statusWriter: StatusWriter;
  readonly authoringAppId: number;
  readonly authoringBotId: number;
  readonly stagingDirectory: string;
  readonly maximumCommits: number;
  readonly maximumRelatedIssues: number;
  readonly fetchImpl?: FetchLike;
  // This runs in the trusted job. It verifies applicable Role authority for
  // the exact sealed bytes; the scope reader independently resolves owners.
  readonly readOwnerBinding: (
    request: PreparedAuthoringRequest,
    payload: Uint8Array,
    boundary: Boundary,
  ) => Promise<AuthoringOwnerBinding | null>;
}

// Static dispatch keeps the execution job from treating intake as a GitHub
// proxy. Every adapter obtains its credentials from this protected composition.
export function createAuthoringOperationResolver(
  configuration: ResolverConfiguration,
): AuthoringExecutionPorts["resolve"] {
  const { readToken, authoringToken, projectsReadToken, projectsWriteToken } =
    configuration;
  const tokens = [
    readToken,
    authoringToken,
    projectsReadToken,
    projectsWriteToken,
  ];
  if (
    tokens.some((token) => !token.trim()) ||
    new Set(tokens).size !== tokens.length
  ) {
    throw new Error("AUTHORING_CREDENTIALS_UNVERIFIED");
  }
  return async (
    request,
    payload,
    boundary,
  ): Promise<ResolvedAuthoringOperation | null> => {
    const binding = await configuration.readOwnerBinding(
      request,
      payload,
      boundary,
    );
    if (!binding) {
      return null;
    }
    const readScope = () =>
      readAuthoringOwnerScope({
        request,
        payload,
        reservation: boundary.reservation?.reservation ?? null,
        repositoryReadToken: readToken,
        projectsReadToken,
        maximumRelatedIssues: configuration.maximumRelatedIssues,
        ...(configuration.fetchImpl
          ? { fetchImpl: configuration.fetchImpl }
          : {}),
      });
    const scope = await readScope();
    if (!scope) {
      return null;
    }
    const operation = await resolveOperation(
      configuration,
      request,
      payload,
      binding,
      scope,
    );
    return operation
      ? {
          ...operation,
          isCurrent: async () =>
            isDeepStrictEqual(await readScope(), scope) &&
            operation.isCurrent(),
        }
      : null;
  };
}

function resolveOperation(
  configuration: ResolverConfiguration,
  request: PreparedAuthoringRequest,
  payload: Uint8Array,
  binding: AuthoringOwnerBinding,
  owners: {
    readonly scope: ControlledWriteScope;
    readonly reserved: ReservedWriteContext | null;
  },
): Promise<ResolvedAuthoringOperation | null> {
  const input = {
    ...binding,
    ...owners,
    inventoryComplete: true,
    request,
    payload,
    readToken: configuration.readToken,
    authoringToken: configuration.authoringToken,
    expectedBotId: configuration.authoringBotId,
    expectedAppId: configuration.authoringAppId,
    ...(configuration.fetchImpl ? { fetchImpl: configuration.fetchImpl } : {}),
  };
  switch (request.command.kind) {
    case "publish-commit":
      return binding.sourceBaseSha && binding.verifyGitInventory
        ? resolveGitAuthoringOperation({
            ...input,
            sourceBaseSha: binding.sourceBaseSha,
            verifyInventory: binding.verifyGitInventory,
            stagingDirectory: configuration.stagingDirectory,
            maximumCommits: configuration.maximumCommits,
          })
        : Promise.resolve(null);
    case "create-pull-request":
    case "create-task":
      return resolveAuthoringCreationOperation(input);
    case "edit-work":
    case "edit-pull-request":
      return resolveAuthoringMetadataOperation(input);
    case "edit-task-dependency":
    case "record-evidence":
      return resolveAuthoringFactsOperation(input);
    case "record-project-field":
      if (request.command.fieldId === configuration.statusFieldId) {
        return binding.authenticatedStatus
          ? resolveAuthoringStatusOperation({
              ...input,
              authenticatedCommand: binding.authenticatedStatus,
              writer: configuration.statusWriter,
            })
          : Promise.resolve(null);
      }
      return resolveAuthoringProjectFieldOperation({
        ...input,
        statusFieldId: configuration.statusFieldId,
        projectsReadToken: configuration.projectsReadToken,
        projectsWriteToken: configuration.projectsWriteToken,
      });
  }
}
