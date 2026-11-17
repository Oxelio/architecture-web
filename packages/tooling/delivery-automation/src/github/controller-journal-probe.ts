type Operation = "GET" | "POST" | "PATCH" | "DELETE";

interface ProbeInput {
  readonly runId: number;
  readonly mainSha: string;
  readonly parentSha: string;
  readonly workflowToken: string;
  readonly controllerToken: string;
  readonly fetchImpl?: typeof fetch;
}

const gitApi = "https://api.github.com/repos/Oxelio/architecture-web/git";
const shaPattern = /^[a-f0-9]{40}$/u;

async function requireRulesetDenial(response: Response, operation: string) {
  if (response.status === 403 || response.status === 422) {
    const result: unknown = await response.json().catch(() => null);
    if (
      result &&
      typeof result === "object" &&
      "message" in result &&
      typeof result.message === "string" &&
      /\bGH013\b|repository rule violations?/iu.test(result.message)
    ) {
      return;
    }
  }
  throw new Error(
    `Expected ruleset denial for ${operation}; received HTTP ${response.status}`,
  );
}

async function requireCommitReference(
  response: Response,
  status: number,
  ref: string,
  sha: string,
) {
  if (response.status !== status) {
    throw new Error(
      `Expected HTTP ${status} for the exact probe ref; received HTTP ${response.status}`,
    );
  }
  const body: { ref?: string; object?: { type?: string; sha?: string } } =
    await response.json();
  if (
    body.ref !== ref ||
    body.object?.type !== "commit" ||
    body.object.sha !== sha
  ) {
    throw new Error("Probe reference identity or target is inconsistent");
  }
}

export async function verifyControllerJournalEnforcement(input: ProbeInput) {
  if (
    !Number.isSafeInteger(input.runId) ||
    input.runId <= 0 ||
    !shaPattern.test(input.mainSha) ||
    !shaPattern.test(input.parentSha) ||
    input.mainSha === input.parentSha ||
    !input.workflowToken.trim() ||
    !input.controllerToken.trim() ||
    input.workflowToken === input.controllerToken
  ) {
    throw new Error("Invalid probe context");
  }

  // This protected prefix is outside the reservation scan. Revocation readers
  // only read exact, numeric delegation IDs, never probe refs.
  const ref = `refs/tags/delivery-control/disabled-probe-${input.runId}`;
  const readPath = `ref/${ref.slice("refs/".length)}`;
  const writePath = `refs/${ref.slice("refs/".length)}`;
  const request = (
    token: string,
    method: Operation,
    path: string,
    body?: object,
  ) =>
    (input.fetchImpl ?? fetch)(`${gitApi}/${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2026-03-10",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const read = () => request(input.workflowToken, "GET", readPath);
  const create = (token: string) =>
    request(token, "POST", "refs", { ref, sha: input.mainSha });

  if ((await read()).status !== 404) {
    throw new Error("Expected an unused probe reference");
  }
  await requireRulesetDenial(
    await create(input.workflowToken),
    "ordinary creation",
  );
  await requireCommitReference(
    await create(input.controllerToken),
    201,
    ref,
    input.mainSha,
  );
  await requireRulesetDenial(
    await request(input.controllerToken, "PATCH", writePath, {
      sha: input.parentSha,
      force: true,
    }),
    "controller update",
  );
  await requireRulesetDenial(
    await request(input.controllerToken, "DELETE", writePath),
    "controller deletion",
  );
  await requireCommitReference(await read(), 200, ref, input.mainSha);

  return {
    ref,
    sha: input.mainSha,
    ordinaryCreation: "denied",
    controllerCreation: "allowed",
    controllerUpdate: "denied",
    controllerDeletion: "denied",
  } as const;
}
