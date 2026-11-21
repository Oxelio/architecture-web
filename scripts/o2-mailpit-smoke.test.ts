import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

const testSignal = AbortSignal.timeout(120_000);

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
  await post(
    "/me/deletion",
    { password, confirmation: "DELETE" },
    202,
    session,
  );
  const cancellation = await tokenFrom(
    "Cancel account deletion",
    /http:\/\/fixture\.invalid\/cancel-deletion\?token=([A-Za-z0-9_-]+)/u,
  );
  await post("/deletion/cancel", { token: cancellation, password }, 204);
  await post("/signin", { login, password }, 204);
}

test("captures IAM and Notifications email and restores access after cancellation", async () => {
  await smoke("http://127.0.0.1:3000", "http://127.0.0.1:8025");
});
