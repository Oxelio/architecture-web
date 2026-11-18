import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import type { ResolvedAuthoringOperation } from "./controlled-authoring-execution.js";
import type { ProjectStatusCommand } from "./project-status-command.js";
import type { createCoordinatedProjectStatusWriter } from "./work-status-writer.js";

type StatusWriter = NonNullable<
  ReturnType<typeof createCoordinatedProjectStatusWriter>
>;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function projectStatusBeforeDigest(
  snapshot: NonNullable<Awaited<ReturnType<StatusWriter["readStatus"]>>>,
) {
  return digest([
    "project-status",
    snapshot.binding.projectId,
    snapshot.binding.itemId,
    snapshot.binding.fieldId,
    snapshot.name,
    snapshot.updatedAt,
    snapshot.binding.fromOptionId,
    snapshot.binding.toOptionId,
  ]);
}

// The existing Status owner still authenticates the transition and establishes
// its Method result. This adapter changes only its durable write route: Status
// participates in scoped authoring admission instead of the legacy global slot.
export async function resolveAuthoringStatusOperation(input: {
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly authenticatedCommand: ProjectStatusCommand;
  readonly writer: StatusWriter;
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
  readonly inventoryComplete: boolean;
  readonly authorityDigest: string;
  readonly readAuthority: () => Promise<string | null>;
}): Promise<ResolvedAuthoringOperation | null> {
  const { request, authenticatedCommand: command, writer } = input;
  let submitted: unknown;
  try {
    submitted = JSON.parse(
      Buffer.from(input.payload).toString("utf8"),
    ) as unknown;
  } catch {
    return null;
  }
  if (
    !isDeepStrictEqual(submitted, command) ||
    createHash("sha256").update(input.payload).digest("hex") !==
      request.command.payloadDigest ||
    request.command.kind !== "record-project-field" ||
    command.workNumber !== request.workNumber ||
    command.from === command.to ||
    input.scope.kind !== "record-project-field" ||
    !input.scope.affectedWorks.includes(request.workNumber)
  ) {
    return null;
  }
  const snapshot = await writer.readStatus(command);
  if (
    !snapshot ||
    snapshot.binding.projectId !== "PVT_kwHOBPzbjc4Bgts6" ||
    snapshot.binding.itemId !== request.command.itemId ||
    snapshot.binding.fieldId !== request.command.fieldId ||
    snapshot.name !== command.from ||
    Date.parse(snapshot.updatedAt) !== Date.parse(command.statusUpdatedAt) ||
    projectStatusBeforeDigest(snapshot) !== request.command.beforeStateDigest
  ) {
    return null;
  }
  const isCurrent = async () => {
    const current = await writer.readStatus(command);
    return (
      current !== null &&
      projectStatusBeforeDigest(current) === projectStatusBeforeDigest(snapshot)
    );
  };
  return {
    scope: input.scope,
    reserved: input.reserved,
    inventoryComplete: input.inventoryComplete,
    authorityDigest: input.authorityDigest,
    readAuthority: input.readAuthority,
    isCurrent,
    async perform(authorize) {
      const result = await writer.writeStatus(
        command,
        snapshot.binding,
        authorize,
      );
      if (result === "unstarted") {
        return {
          outcome: "known-unstarted",
          proofDigest: digest([
            "status-handoff-not-started",
            request.requestId,
            snapshot.binding,
          ]),
        };
      }
      if (result !== "confirmed") {
        return null;
      }
      const observed = await writer.readStatus(command);
      if (
        observed?.name !== command.to ||
        observed.binding.projectId !== snapshot.binding.projectId ||
        observed.binding.itemId !== snapshot.binding.itemId ||
        observed.binding.fieldId !== snapshot.binding.fieldId ||
        observed.binding.toOptionId !== snapshot.binding.toOptionId ||
        !Number.isFinite(Date.parse(observed.updatedAt)) ||
        Date.parse(observed.updatedAt) < Date.parse(snapshot.updatedAt)
      ) {
        return null;
      }
      return {
        outcome: "confirmed",
        proofDigest: digest(["status-applied", request.requestId, observed]),
      };
    },
  };
}
