import { createHash } from "node:crypto";

import { z } from "zod";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import { isControlledBranchRef } from "../control/controlled-write.js";
import type { AuthoringOwnerBinding } from "./authoring-operation-resolver.js";
import type { AuthoringGitInventory } from "./git-authoring-operation.js";
import type { ProjectStatusCommand } from "./project-status-command.js";

const digestPattern = /^[a-f0-9]{64}$/u;
const shaPattern = /^[a-f0-9]{40}$/u;
const number = z.number().int().positive().safe();
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const source = z.strictObject({
  ref: z.string().refine(isControlledBranchRef),
  baseSha: z.string().regex(shaPattern),
  paths: z
    .array(
      z
        .string()
        .regex(
          /^(?:apps|packages\/adapters|packages\/contexts|packages\/shared)\/[A-Za-z0-9_./-]+\/$/u,
        ),
    )
    .min(1),
  allowNonFastForward: z.boolean(),
});

const permission = z.strictObject({
  actorDigest: z.string().regex(digestPattern),
  workNumber: number,
  kinds: z
    .array(
      z.enum([
        "publish-commit",
        "create-pull-request",
        "create-task",
        "edit-pull-request",
        "edit-work",
        "edit-task-dependency",
        "record-evidence",
        "record-project-field",
      ]),
    )
    .min(1),
  commandDigests: z.array(z.string().regex(digestPattern)),
  statusCommandCommentId: number.optional(),
  priorityCommandDigests: z.array(z.string().regex(digestPattern)).optional(),
  source: source.optional(),
});

// Scope established by the maintainer's eventual controlled-deployment
// decision. This schema does not confer a Method role or establish a result.
export const protectedAuthoringChannelSchema = z.strictObject({
  kind: z.literal("protected-authoring-channel"),
  repositoryId: z.literal(1336937640),
  projectNumber: z.literal(3),
  workflowPath: z.literal(".github/workflows/delivery-authoring.yml"),
  intakeOrigin: z.string(),
  dispatchActorId: number,
  approvedControlRevision: z.string().regex(shaPattern),
  authoringAppId: number,
  authoringInstallationId: number,
  authoringBotId: number,
  expiresAt: z.string().datetime(),
  permissions: z.array(permission).min(1),
});
export type ProtectedAuthoringChannel = z.infer<
  typeof protectedAuthoringChannelSchema
>;

type Permission = z.infer<typeof permission>;
const evidenceBound = new Set([
  "create-task",
  "edit-task-dependency",
  "record-evidence",
  "record-project-field",
]);

function matchesPermission(
  request: PreparedAuthoringRequest,
  grant: Permission,
) {
  if (
    grant.actorDigest !== request.actorDigest ||
    grant.workNumber !== request.workNumber ||
    !grant.kinds.includes(request.command.kind) ||
    (evidenceBound.has(request.command.kind) &&
      !grant.commandDigests.includes(request.commandDigest))
  ) {
    return false;
  }
  const command = request.command;
  if (command.kind === "create-pull-request") {
    return (
      grant.source?.ref === command.sourceRef &&
      grant.source.baseSha === command.baseSha
    );
  }
  return (
    command.kind !== "publish-commit" || grant.source?.ref === command.sourceRef
  );
}

function permitsInventory(
  inventory: AuthoringGitInventory,
  grant: NonNullable<Permission["source"]>,
) {
  return (
    inventory.sourceRef === grant.ref &&
    inventory.sourceBaseSha === grant.baseSha &&
    inventory.paths.every(
      (path) =>
        /^[A-Za-z0-9_./-]+$/u.test(path) &&
        path
          .split("/")
          .every((part) => !part.startsWith(".") && part.length > 0) &&
        !/(?:^|\/)(?:AGENTS\.md|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|sonar-project\.properties)$/iu.test(
          path,
        ) &&
        grant.paths.some((prefix) => path.startsWith(prefix)),
    )
  );
}

export function createProtectedAuthoringAuthority(input: {
  readonly readChannel: () => Promise<ProtectedAuthoringChannel | null>;
  readonly statusFieldId: string;
  readonly readStatusCommand: (
    request: PreparedAuthoringRequest,
  ) => Promise<ProjectStatusCommand | null>;
  readonly now?: () => number;
}) {
  const now = input.now ?? Date.now;
  async function authority(request: PreparedAuthoringRequest) {
    const channel = await input.readChannel();
    if (!channel || now() >= Date.parse(channel.expiresAt)) {
      return null;
    }
    const matches = channel.permissions.filter((grant) =>
      matchesPermission(request, grant),
    );
    const grant = matches.length === 1 ? matches[0] : null;
    return grant
      ? {
          grant,
          digest: digest([channel, request.actorDigest, request.commandDigest]),
        }
      : null;
  }
  return async (
    request: PreparedAuthoringRequest,
  ): Promise<AuthoringOwnerBinding | null> => {
    const current = await authority(request);
    if (!current) {
      return null;
    }
    const needsStatus =
      request.command.kind === "record-project-field" &&
      request.command.fieldId === input.statusFieldId;
    const status = needsStatus ? await input.readStatusCommand(request) : null;
    if (needsStatus && !status) {
      return null;
    }
    const readAuthority = async () => {
      const rechecked = await authority(request);
      if (
        needsStatus &&
        digest(await input.readStatusCommand(request)) !== digest(status)
      ) {
        return null;
      }
      return rechecked?.digest ?? null;
    };
    const base = {
      authorityDigest: current.digest,
      readAuthority,
      ...(current.grant.priorityCommandDigests?.includes(request.commandDigest)
        ? { readPriorityAuthority: readAuthority }
        : {}),
    };
    if (!current.grant.source || request.command.kind !== "publish-commit") {
      return status ? { ...base, authenticatedStatus: status } : base;
    }
    const grant = current.grant.source;
    return {
      ...base,
      sourceBaseSha: grant.baseSha,
      allowNonFastForward: grant.allowNonFastForward,
      verifyGitInventory: async (inventory) =>
        permitsInventory(inventory, grant),
    };
  };
}
