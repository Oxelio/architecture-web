import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { FetchLike } from "./github-project-inventory.js";
import { createGitHubWorkReservationJournal } from "./github-work-reservation-journal.js";
import {
  claimProjectStatusCommand,
  type ProjectStatusCommand,
} from "./project-status-command.js";

type Journal = ReturnType<typeof createGitHubWorkReservationJournal>;
type Boundary = Awaited<ReturnType<Journal["readProjectStatusBoundary"]>>;

export interface ProjectStatusBinding {
  readonly projectId: string;
  readonly itemId: string;
  readonly fieldId: string;
  readonly fromOptionId: string;
  readonly toOptionId: string;
}

interface ProjectStatusSnapshot {
  readonly binding: ProjectStatusBinding;
  readonly name: string;
  readonly updatedAt: string;
}

interface AuthorizedStatusWrite {
  readonly command: ProjectStatusCommand;
  readonly authorityId: number;
}

type StatusWriteResult =
  | "inactive"
  | "denied"
  | "deferred"
  | "already-admitted"
  | "recorded"
  | "reconciled";

export async function runCoordinatedStatusWrite(input: {
  readonly enabled: boolean;
  readonly recoveryOnly?: boolean;
  readonly commentId: number;
  readonly workflowSha: string;
  readonly controllerToken: string;
  readonly fetchImpl?: FetchLike;
  readonly readAuthorization: () => Promise<AuthorizedStatusWrite | null>;
  readonly readRecoveryAuthorization: (
    authorityId: number,
  ) => Promise<AuthorizedStatusWrite | null>;
  readonly verifyBoundary: () => Promise<boolean>;
  readonly mayWriteWithReservation: (
    reservation: NonNullable<Boundary["reservation"]>,
    workNumber: number,
  ) => Promise<boolean>;
  readonly readStatus: (
    command: ProjectStatusCommand,
  ) => Promise<ProjectStatusSnapshot | null>;
  readonly writeStatus: (
    command: ProjectStatusCommand,
    binding: ProjectStatusBinding,
    authorize: () => Promise<boolean>,
  ) => Promise<"unstarted" | "unverified" | "confirmed">;
}): Promise<StatusWriteResult> {
  if (!input.enabled) {
    return "inactive";
  }

  const connection = {
    repositoryToken: input.controllerToken,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
  };
  const journal = createGitHubWorkReservationJournal(connection);
  try {
    if (
      !Number.isSafeInteger(input.commentId) ||
      input.commentId <= 0 ||
      !(await input.verifyBoundary())
    ) {
      return "denied";
    }
    const receipt = { ...connection, commentId: input.commentId };
    let current = await journal.readProjectStatusBoundary();
    if (current.pending) {
      return reconcilePendingStatusWrite(input, journal, current, receipt);
    }

    if (input.recoveryOnly) {
      return "denied";
    }
    const authorization = await input.readAuthorization();
    if (
      !authorization ||
      !Number.isSafeInteger(authorization.authorityId) ||
      authorization.authorityId <= 0
    ) {
      return "denied";
    }
    const { command } = authorization;
    const stillAuthorized = async () =>
      isDeepStrictEqual(authorization, await input.readAuthorization()) &&
      (await input.verifyBoundary());

    const used = await readProjectStatusReceipt(receipt);
    if (used !== false) {
      return used ? "already-admitted" : "deferred";
    }
    if (
      current.reservation &&
      !(await input.mayWriteWithReservation(
        current.reservation,
        command.workNumber,
      ))
    ) {
      return "deferred";
    }

    // The guard may have settled the exact reservation durably.
    const guarded = current.reservation;
    current = await journal.readProjectStatusBoundary();
    if (
      !isDeepStrictEqual(guarded, current.reservation) &&
      (!guarded ||
        current.reservation?.reservationId !== guarded.reservationId ||
        !["cancelled", "merged", "invalidated"].includes(
          current.reservation.reservation.state.phase,
        ))
    ) {
      return "deferred";
    }
    const snapshot = await input.readStatus(command);
    if (
      current.pending ||
      snapshot?.name !== command.from ||
      Date.parse(snapshot.updatedAt) !== Date.parse(command.statusUpdatedAt) ||
      !(await stillAuthorized())
    ) {
      return "deferred";
    }
    const intent = buildStatusIntent(
      input.commentId,
      authorization,
      snapshot.binding,
    );
    const position = await journal.beginProjectStatusWrite({
      previous: current.position,
      workflowSha: input.workflowSha,
      intent,
    });
    if (!position) {
      return "deferred";
    }
    if (
      !(await stillAuthorized()) ||
      !(await claimProjectStatusCommand({
        ...receipt,
        controllerToken: input.controllerToken,
        workflowSha: input.workflowSha,
      })) ||
      !(await stillAuthorized()) ||
      !isDeepStrictEqual(snapshot, await input.readStatus(command))
    ) {
      if (await input.verifyBoundary()) {
        await journal.finishProjectStatusWrite(position, intent);
      }
      return "deferred";
    }

    // Unknown acknowledgement leaves the intent pending. Recovery reads the
    // Project and never dispatches the mutation a second time.
    const dispatch = await input.writeStatus(
      command,
      snapshot.binding,
      stillAuthorized,
    );
    if (dispatch === "unstarted" && (await input.verifyBoundary())) {
      await journal.finishProjectStatusWrite(position, intent);
    }
    if (
      dispatch !== "confirmed" ||
      !observesDestination(
        await input.readStatus(command),
        command,
        snapshot.binding,
      )
    ) {
      return "deferred";
    }
    return (await journal.finishProjectStatusWrite(position, intent))
      ? "recorded"
      : "deferred";
  } catch {
    return "deferred";
  }
}

async function reconcilePendingStatusWrite(
  input: Parameters<typeof runCoordinatedStatusWrite>[0],
  journal: Journal,
  current: Boundary,
  receipt: Parameters<typeof readProjectStatusReceipt>[0],
): Promise<"reconciled" | "deferred"> {
  const recovery = current.pending;
  if (!recovery || recovery.commentId !== input.commentId || !current.position) {
    return "deferred";
  }
  const previous = await input.readRecoveryAuthorization(recovery.authorityId);
  const observed = previous
    ? await input.readStatus(previous.command)
    : null;
  if (
    !previous ||
    !observed ||
    !isDeepStrictEqual(
      recovery,
      buildStatusIntent(input.commentId, previous, observed.binding),
    ) ||
    (await readProjectStatusReceipt(receipt)) !== true ||
    !observesDestination(observed, previous.command, observed.binding) ||
    !(await input.verifyBoundary())
  ) {
    return "deferred";
  }
  return (await journal.finishProjectStatusWrite(current.position, recovery))
    ? "reconciled"
    : "deferred";
}

function observesDestination(
  current: ProjectStatusSnapshot | null,
  command: ProjectStatusCommand,
  binding: ProjectStatusBinding,
): boolean {
  return (
    current?.name === command.to &&
    Date.parse(current.updatedAt) > Date.parse(command.statusUpdatedAt) &&
    isDeepStrictEqual(current.binding, binding)
  );
}

function buildStatusIntent(
  commentId: number,
  authorization: AuthorizedStatusWrite,
  binding: ProjectStatusBinding,
) {
  return {
    commentId,
    workNumber: authorization.command.workNumber,
    authorityId: authorization.authorityId,
    commandDigest: createHash("sha256")
      .update(JSON.stringify({ authorization, binding }))
      .digest("hex"),
  };
}

async function readProjectStatusReceipt(input: {
  readonly repositoryToken: string;
  readonly commentId: number;
  readonly fetchImpl?: FetchLike;
}): Promise<boolean | null> {
  const ref = `tags/delivery-control/status-${input.commentId}`;
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.github.com/repos/Oxelio/architecture-web/git/ref/${ref}`,
    {
      redirect: "error",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.repositoryToken}`,
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  if (response.status === 404) {
    return false;
  }
  if (response.status !== 200) {
    return null;
  }
  const value = (await response.json()) as {
    readonly ref?: string;
    readonly object?: { readonly type?: string; readonly sha?: string };
  } | null;
  return value?.ref === `refs/${ref}` &&
    value.object?.type === "commit" &&
    typeof value.object.sha === "string" &&
    /^[0-9a-f]{40}$/u.test(value.object.sha)
    ? true
    : null;
}
