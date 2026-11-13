import { createHash } from "node:crypto";

import type { DeliveryActivationManifest } from "../config/activation-manifest.js";
import {
  isWorkIntegrationCandidate,
  sameWorkIntegrationCandidate,
} from "../control/work-integration-request.js";
import {
  readStandingWorkClassification,
  type StandingWorkClassification,
} from "./gate-live-evidence.js";
import type { FetchLike } from "./github-project-inventory.js";
import type { MergeCandidate } from "./work-merge-publisher.js";
import { workReference } from "./work-reference.js";

interface StandingWorkFacts extends StandingWorkClassification {
  readonly candidate: MergeCandidate;
  readonly changedPaths: readonly string[];
  readonly digest: string;
}

interface StandingFactsReader {
  readonly repository: string;
  readonly repositoryToken: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly manifest: DeliveryActivationManifest;
  readonly fetchImpl?: FetchLike;
}

interface CandidatePull {
  readonly number: number;
  readonly body: string | null;
  readonly state: string;
  readonly draft: boolean;
  readonly merged: boolean;
  readonly changed_files: number;
  readonly head: {
    readonly sha: string;
    readonly repo?: { readonly id: number } | null;
  };
  readonly base: {
    readonly sha: string;
    readonly ref: string;
    readonly repo?: { readonly id: number } | null;
  };
}

const repositoryId = 1336937640;
const fileStatuses = new Set([
  "added",
  "removed",
  "modified",
  "renamed",
  "copied",
  "changed",
  "unchanged",
]);

function validPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    !path.includes("\\") &&
    !path
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  );
}

export async function readStandingWorkFacts(
  reader: StandingFactsReader,
  candidate: MergeCandidate,
): Promise<StandingWorkFacts | null> {
  if (
    reader.repository.toLowerCase() !== "oxelio/architecture-web" ||
    !isWorkIntegrationCandidate(candidate) ||
    !reader.repositoryToken.trim() ||
    !reader.projectsToken.trim()
  ) {
    return null;
  }

  const fetchImpl = reader.fetchImpl ?? fetch;
  const pullUrl = `https://api.github.com/repos/${reader.repository}/pulls/${candidate.pullNumber}`;
  const options = {
    redirect: "error",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${reader.repositoryToken}`,
      "x-github-api-version": "2026-03-10",
    },
  } as const;
  const readPull = async () => {
    const response = await fetchImpl(pullUrl, options);
    if (response.status !== 200) {
      return null;
    }
    const pr = (await response.json()) as CandidatePull;
    return pr.number === candidate.pullNumber &&
      pr.state === "open" &&
      pr.draft === false &&
      pr.merged === false &&
      pr.head.repo?.id === repositoryId &&
      pr.head.sha === candidate.headSha &&
      pr.base.repo?.id === repositoryId &&
      pr.base.ref === "main" &&
      pr.base.sha === candidate.baseSha &&
      workReference(pr.body) === candidate.workNumber
      ? pr
      : null;
  };

  try {
    const [pr, classification] = await Promise.all([
      readPull(),
      readStandingWorkClassification({
        ...reader,
        workNumber: candidate.workNumber,
        fetchImpl,
      }),
    ]);
    if (
      !pr ||
      !classification ||
      !Number.isSafeInteger(pr.changed_files) ||
      pr.changed_files <= 0 ||
      pr.changed_files >= 3000
    ) {
      return null;
    }

    const files = new Set<string>();
    const paths = new Set<string>();
    for (let page = 1; page <= Math.ceil(pr.changed_files / 100); page++) {
      const response = await fetchImpl(
        `${pullUrl}/files?per_page=100&page=${page}`,
        options,
      );
      if (response.status !== 200) {
        return null;
      }
      const changed = (await response.json()) as readonly {
        readonly filename?: unknown;
        readonly previous_filename?: unknown;
        readonly status?: string;
      }[];
      if (
        !Array.isArray(changed) ||
        changed.length !== Math.min(100, pr.changed_files - (page - 1) * 100)
      ) {
        return null;
      }
      for (const file of changed) {
        if (
          !validPath(file?.filename) ||
          files.has(file.filename) ||
          !file.status ||
          !fileStatuses.has(file.status)
        ) {
          return null;
        }
        files.add(file.filename);
        paths.add(file.filename);
        if (
          file.previous_filename !== undefined ||
          file.status === "renamed" ||
          file.status === "copied"
        ) {
          if (!validPath(file.previous_filename)) {
            return null;
          }
          paths.add(file.previous_filename);
        }
      }
    }

    const current = await readPull();
    if (
      !current ||
      current.changed_files !== pr.changed_files ||
      files.size !== pr.changed_files
    ) {
      return null;
    }

    const changedPaths = [...paths].sort();
    const digest = createHash("sha256")
      .update(
        JSON.stringify([
          candidate.workNumber,
          candidate.pullNumber,
          candidate.headSha,
          candidate.baseSha,
          classification.workType,
          classification.workflowDepth,
          classification.characteristics,
          changedPaths,
        ]),
      )
      .digest("hex");
    return { ...classification, candidate, changedPaths, digest };
  } catch {
    return null;
  }
}

export interface AcceptedStandingImpact {
  readonly candidate: MergeCandidate;
  readonly factsDigest: string;
  readonly disposition: "ordinary" | "manual";
}

export async function verifyStandingWorkEligibility(input: {
  readonly reader: StandingFactsReader;
  readonly candidate: MergeCandidate;
  // The protected evidence reader establishes acceptance under the applicable review authority.
  readonly readAcceptedImpact: (
    candidate: MergeCandidate,
  ) => Promise<AcceptedStandingImpact | null>;
}): Promise<boolean> {
  try {
    const facts = await readStandingWorkFacts(input.reader, input.candidate);
    if (
      !facts ||
      facts.changedPaths.some(
        (path) =>
          path.startsWith(".github/") ||
          path.startsWith("docs/architecture/decisions/") ||
          path.startsWith("docs/project/") ||
          path.startsWith("packages/tooling/delivery-automation/") ||
          path === "AGENTS.md" ||
          path === ".gitmodules",
      )
    ) {
      return false;
    }
    const impact = await input.readAcceptedImpact(input.candidate);
    return (
      impact?.disposition === "ordinary" &&
      sameWorkIntegrationCandidate(facts.candidate, impact.candidate) &&
      impact.factsDigest === facts.digest
    );
  } catch {
    return false;
  }
}
