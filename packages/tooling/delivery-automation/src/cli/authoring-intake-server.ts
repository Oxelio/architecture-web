import { readFile } from "node:fs/promises";

import { z } from "zod";

import { createAuthoringControlVerifier } from "../github/authoring-control-revision.js";
import {
  createAuthoringDispatcher,
  createProjectProjectionDispatcher,
} from "../intake/authoring-dispatch.js";
import { createAuthoringIntakeNodeServer } from "../intake/authoring-intake.js";
import { createAuthoringProjectProjection } from "../intake/authoring-project-projection.js";
import { createGitHubJobAuthenticator } from "../intake/github-job-authentication.js";
import { SealedAuthoringStore } from "../intake/sealed-authoring-store.js";
import {
  positiveInteger,
  requiredEnvironment,
  writeJson,
} from "./gate-publication-support.js";

const callersSchema = z
  .array(
    z.strictObject({
      subject: z.string().min(1),
      tokenDigest: z.string().regex(/^[a-f0-9]{64}$/u),
      workNumbers: z.array(z.number().int().positive().safe()),
    }),
  )
  .min(1);
const dispatchCredential = z.strictObject({
  token: z.string().min(1),
  expiresAt: z.number().int().positive().safe(),
});

async function main() {
  if (process.env["DELIVERY_AUTHORING_INTAKE_ENABLED"] !== "true") {
    writeJson({ status: "inactive" });
    return;
  }
  const origin = requiredEnvironment("DELIVERY_AUTHORING_INTAKE_ORIGIN");
  const callers = callersSchema.parse(
    JSON.parse(requiredEnvironment("DELIVERY_AUTHORING_CALLERS")) as unknown,
  );
  if (
    new Set(callers.map((caller) => caller.subject)).size !== callers.length
  ) {
    throw new Error("AUTHORING_CALLERS_AMBIGUOUS");
  }
  const tokenPath = requiredEnvironment(
    "DELIVERY_AUTHORING_DISPATCH_CREDENTIAL_FILE",
  );
  const readToken = async () => {
    const credential = dispatchCredential.safeParse(
      JSON.parse(await readFile(tokenPath, "utf8")) as unknown,
    );
    return credential.success ? credential.data : null;
  };
  const maximumAgeMs = positiveInteger("DELIVERY_AUTHORING_PROJECTION_AGE_MS");
  const projection = createAuthoringProjectProjection({
    dispatch: createProjectProjectionDispatcher({ readToken }),
    maximumAgeMs,
  });
  const verifyWorkflowRevision = createAuthoringControlVerifier({
    approvedRevision: requiredEnvironment(
      "DELIVERY_AUTHORING_CONTROL_REVISION",
    ),
  });
  const maximumLifetimeMs = positiveInteger(
    "DELIVERY_AUTHORING_PAYLOAD_LIFETIME_MS",
  );
  const store = new SealedAuthoringStore({
    directory: requiredEnvironment("DELIVERY_AUTHORING_STAGING_DIRECTORY"),
    maximumPayloadBytes: positiveInteger(
      "DELIVERY_AUTHORING_MAXIMUM_PAYLOAD_BYTES",
    ),
    maximumLifetimeMs,
  });
  await store.expirePayloads();
  setInterval(
    () => {
      void store.expirePayloads().catch(() => {
        console.error("AUTHORING_STAGE_CLEANUP_FAILED");
      });
    },
    Math.min(maximumLifetimeMs, 60_000),
  ).unref();
  const intake = createAuthoringIntakeNodeServer({
    enabled: true,
    publicOrigin: origin,
    callers,
    store,
    maximumRequestBytes: positiveInteger(
      "DELIVERY_AUTHORING_MAXIMUM_EXCHANGE_BYTES",
    ),
    authenticateJob: createGitHubJobAuthenticator({
      audience: origin,
      subject: "repo:Oxelio/architecture-web:environment:delivery-authoring",
      dispatchActorId: requiredEnvironment(
        "DELIVERY_AUTHORING_DISPATCH_ACTOR_ID",
      ),
      environment: "delivery-authoring",
      verifyWorkflowRevision,
    }),
    dispatch: createAuthoringDispatcher({ readToken }),
    acceptProjectContext: projection.accept,
    readProjectContext: async (subject) => {
      const allowed =
        callers.find((caller) => caller.subject === subject)?.workNumbers ?? [];
      const view = await projection.read();
      return "works" in view && view.works
        ? {
            ...view,
            works: view.works.filter((work) =>
              allowed.includes(work.workNumber),
            ),
          }
        : view;
    },
  });
  // Keep the listener in the private deployment principal. Only its trusted
  // TLS proxy is expected to forward the configured public host.
  intake.server.on("error", () => {
    writeJson({ status: "denied" });
    process.exitCode = 1;
  });
  intake.server.listen(
    positiveInteger("DELIVERY_AUTHORING_INTAKE_PORT"),
    "127.0.0.1",
  );
}

try {
  await main();
} catch {
  writeJson({ status: "denied" });
  process.exitCode = 1;
}
