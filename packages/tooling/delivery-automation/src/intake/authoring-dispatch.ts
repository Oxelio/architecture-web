import type { FetchLike } from "../github/github-project-inventory.js";

// Only an installation token narrowed to Actions:write/Metadata:read for this
// repository belongs here. App keys and authoring/merge/Project tokens do not.
export function createAuthoringDispatcher(input: {
  readonly readToken: () => Promise<{
    readonly token: string;
    readonly expiresAt: number;
  } | null>;
  readonly fetchImpl?: FetchLike;
}) {
  return async (requestId: string, payloadDigest: string) => {
    if (
      ![requestId, payloadDigest].every((value) =>
        /^[a-f0-9]{64}$/u.test(value),
      )
    ) {
      return "denied" as const;
    }
    return dispatchAuthoringJob(input, {
      request_id: requestId,
      payload_digest: payloadDigest,
    });
  };
}

export function createProjectProjectionDispatcher(
  input: Parameters<typeof createAuthoringDispatcher>[0],
) {
  return () => dispatchAuthoringJob(input, { project_context: true });
}

async function dispatchAuthoringJob(
  input: Parameters<typeof createAuthoringDispatcher>[0],
  inputs: Record<string, string | boolean>,
) {
  try {
    const credential = await input.readToken();
    if (
      !credential ||
      !credential.token ||
      !Number.isFinite(credential.expiresAt) ||
      Date.now() >= credential.expiresAt
    ) {
      return "unstarted" as const;
    }
    const response = await (input.fetchImpl ?? fetch)(
      "https://api.github.com/repos/Oxelio/architecture-web/actions/workflows/delivery-authoring.yml/dispatches",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${credential.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main",
          inputs,
        }),
      },
    );
    // Even a successful dispatch is not an authoring admission or result.
    return response.status === 204
      ? ("dispatched" as const)
      : ("uncertain" as const);
  } catch {
    return "uncertain" as const;
  }
}
