import type {
  ProjectStatusCommand,
  ProjectStatusComment,
} from "./project-status-command.js";

interface TransitionEvidenceRule {
  readonly kind: string;
  readonly actorId: number;
  readonly appId: number | null;
}

export interface StatusChannel {
  readonly mode: "standing" | "supervised";
  readonly workNumbers?: readonly number[];
  readonly transitions: readonly {
    readonly from: ProjectStatusCommand["from"];
    readonly to: ProjectStatusCommand["to"];
    readonly requirements: readonly TransitionEvidenceRule[];
  }[];
}

export async function verifyTransitionEvidence(
  command: ProjectStatusCommand,
  policy: StatusChannel,
  readComment: (id: number) => Promise<ProjectStatusComment | null>,
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
      const comment = await readComment(id);
      if (
        !comment ||
        comment.id !== id ||
        comment.issue_url !==
          `https://api.github.com/repos/Oxelio/architecture-web/issues/${command.workNumber}` ||
        !comment.created_at ||
        comment.created_at !== comment.updated_at ||
        !(
          Date.parse(comment.created_at) > Date.parse(command.statusUpdatedAt)
        ) ||
        comment.body.length > 4096
      ) {
        return null;
      }
      const record = JSON.parse(comment.body) as Record<string, unknown> | null;
      const issuerApp = comment.performed_via_github_app;
      if (
        !record ||
        record["decision"] !== "accepted" ||
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
