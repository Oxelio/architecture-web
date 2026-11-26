import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const testSignal = AbortSignal.timeout(120_000);
const execute = promisify(execFile);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.any([testSignal, AbortSignal.timeout(3_000)]),
  });
}

async function waitFor<T>(
  description: string,
  probe: () => Promise<T>,
): Promise<NonNullable<T>> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    testSignal.throwIfAborted();
    try {
      const result = await probe();
      if (result) {
        return result;
      }
    } catch {
      testSignal.throwIfAborted();
    }
    await sleep(500, undefined, { signal: testSignal });
  }
  throw new Error(`Fixture did not observe ${description}`);
}

async function smoke(api: string, mailpit: string) {
  const address = "o2-smoke@example.test";
  const login = { kind: "email", value: address };
  const password = `O2!a${randomUUID()}9Z!`;
  const iam = `${api}/v1/iam`;

  async function post(
    route: string,
    body: object,
    status: number,
    cookie?: string,
  ) {
    const response = await request(`${iam}${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie && { Cookie: cookie }),
      },
      body: JSON.stringify(body),
    });
    if (response.status !== status) {
      throw new Error(
        `Fixture received HTTP ${response.status} from ${route}; expected ${status}`,
      );
    }
    return response;
  }

  async function captured(subject: string) {
    return waitFor(subject, async () => {
      const response = await request(`${mailpit}/api/v1/messages`);
      if (!response.ok) {
        return null;
      }
      const data: unknown = await response.json();
      if (!isRecord(data) || !Array.isArray(data["messages"])) {
        throw new Error("Fixture could not read the captured messages");
      }
      const messages: unknown[] = data["messages"];
      for (const message of messages) {
        if (
          isRecord(message) &&
          message["Subject"] === subject &&
          Array.isArray(message["To"]) &&
          message["To"].some(
            (to: unknown) => isRecord(to) && to["Address"] === address,
          )
        ) {
          return message;
        }
      }
      return null;
    });
  }

  async function tokenFrom(subject: string, linkPattern: RegExp) {
    const message = await captured(subject);
    const id = message["ID"];
    if (typeof id !== "string") {
      throw new Error("Fixture could not read the captured message");
    }
    const response = await request(
      `${mailpit}/api/v1/message/${encodeURIComponent(id)}`,
    );
    if (!response.ok) {
      throw new Error("Fixture could not read the captured message");
    }
    const content: unknown = await response.json();
    if (!isRecord(content) || typeof content["Text"] !== "string") {
      throw new Error("Fixture could not read the captured message");
    }
    const token = linkPattern.exec(content["Text"])?.[1];
    if (!token) {
      throw new Error("Fixture did not find the expected token");
    }
    return token;
  }

  await waitFor(
    "API startup",
    async () => (await request(`${iam}/password-policy`)).ok,
  );
  await post(
    "/signup",
    { login, password, passwordConfirmation: password },
    201,
  );
  const verification = await tokenFrom(
    "Please verify your email",
    /http:\/\/fixture\.invalid\/verify#token=([A-Za-z0-9_-]+)/u,
  );
  await post("/verify", { token: verification }, 204);
  const signedIn = await post("/signin", { login, password }, 204);
  const session = signedIn.headers.getSetCookie()[0]?.split(";", 1)[0];
  if (!session) {
    throw new Error("Fixture sign-in returned no session");
  }
  await captured("New session");
  const disclosure = await request(`${iam}/me/deletion`, {
    headers: { Cookie: session },
  });
  const disclosureBody: unknown = await disclosure.json();
  const deletion = isRecord(disclosureBody) ? disclosureBody["data"] : null;
  if (
    !disclosure.ok ||
    !isRecord(deletion) ||
    typeof deletion["gracePeriodDays"] !== "number"
  ) {
    throw new Error("Fixture did not observe the deletion grace period");
  }
  await post(
    "/me/deletion",
    {
      password,
      confirmation: "DELETE",
      confirmedGracePeriodDays: deletion["gracePeriodDays"],
    },
    202,
    session,
  );
  const cancellation = await tokenFrom(
    "Cancel account deletion",
    /http:\/\/fixture\.invalid\/cancel-deletion\?token=([A-Za-z0-9_-]+)/u,
  );
  await post("/deletion/cancel", { token: cancellation, password }, 204);
  await execute(
    process.execPath,
    ["--import", "tsx", "src/scripts/promote-admin.ts", address],
    {
      signal: testSignal,
    },
  );
  const signedInAsAdmin = await post("/signin", { login, password }, 204);
  const adminCookie = signedInAsAdmin.headers
    .getSetCookie()[0]
    ?.split(";", 1)[0];
  if (!adminCookie) {
    throw new Error("Fixture administrator sign-in returned no session");
  }
  async function publishedConfiguration(cookie: string) {
    const response = await request(`${iam}/admin/security/config`, {
      headers: { Cookie: cookie },
    });
    const envelope: unknown = await response.json();
    const data = isRecord(envelope) ? envelope["data"] : null;
    const revision = isRecord(data) ? data["effectiveRevision"] : null;
    const policy = isRecord(data) ? data["effective"] : null;
    const accounts = isRecord(policy) ? policy["accounts"] : null;
    if (
      !response.ok ||
      !isRecord(revision) ||
      typeof revision["version"] !== "number" ||
      !isRecord(policy) ||
      !isRecord(accounts) ||
      typeof accounts["deletionGraceDays"] !== "number"
    ) {
      throw new Error("Fixture did not observe the published configuration");
    }
    return {
      version: revision["version"],
      policy,
      accounts,
      graceDays: accounts["deletionGraceDays"],
    };
  }
  const before = await publishedConfiguration(adminCookie);
  const response = await request(`${iam}/admin/security/config`, {
    method: "PUT",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      values: {
        ...before.policy,
        accounts: {
          ...before.accounts,
          deletionGraceDays: before.graceDays + 1,
        },
      },
      expectedVersion: before.version,
      justification: "Validate the packaged migration and critical publication",
      confirmedCritical: true,
      password,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Packaged critical publication returned HTTP ${response.status}`,
    );
  }
  const after = await publishedConfiguration(adminCookie);
  if (
    after.version !== before.version + 1 ||
    after.graceDays !== before.graceDays + 1
  ) {
    throw new Error("Fixture did not observe the committed critical revision");
  }
}

test("captures email, restores access and publishes a critical revision on the migrated package", async () => {
  await smoke("http://127.0.0.1:3000", "http://127.0.0.1:8025");
});
