import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

const testSignal = AbortSignal.timeout(120_000);

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.any([testSignal, AbortSignal.timeout(3_000)]),
  });
}

async function waitFor(description, probe) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    testSignal.throwIfAborted();
    try {
      const result = await probe();
      if (result) return result;
    } catch {
      testSignal.throwIfAborted();
    }
    await sleep(500, undefined, { signal: testSignal });
  }
  throw new Error(`Fixture did not observe ${description}`);
}

async function smoke(api, mailpit) {
  const address = "o2-smoke@example.test";
  const login = { kind: "email", value: address };
  const password = `O2!a${randomUUID()}9Z!`;
  const iam = `${api}/v1/iam`;

  async function post(route, body, status, cookie) {
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

  async function captured(subject) {
    return waitFor(subject, async () => {
      const response = await request(`${mailpit}/api/v1/messages`);
      if (!response.ok) return null;
      const { messages } = await response.json();
      return messages.find(
        (message) =>
          message.Subject === subject &&
          message.To.some((to) => to.Address === address),
      );
    });
  }

  async function tokenFrom(subject) {
    const message = await captured(subject);
    const response = await request(
      `${mailpit}/api/v1/message/${encodeURIComponent(message.ID)}`,
    );
    if (!response.ok)
      throw new Error("Fixture could not read the captured message");
    const { Text } = await response.json();
    const token = Text.match(
      /http:\/\/fixture\.invalid\/(?:verify|cancel-deletion)\?token=([A-Za-z0-9_-]+)/u,
    )?.[1];
    if (!token) throw new Error("Fixture did not find the expected token");
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
  const verification = await tokenFrom("Please verify your email");
  const verified = await request(
    `${iam}/verify?token=${encodeURIComponent(verification)}`,
  );
  if (verified.status !== 204) throw new Error("Fixture verification failed");
  const signedIn = await post("/signin", { login, password }, 204);
  const session = signedIn.headers.getSetCookie()[0]?.split(";", 1)[0];
  if (!session) throw new Error("Fixture sign-in returned no session");
  await captured("New session");
  await post(
    "/me/deletion",
    { password, confirmation: "DELETE" },
    202,
    session,
  );
  const cancellation = await tokenFrom("Cancel account deletion");
  await post("/deletion/cancel", { token: cancellation, password }, 204);
  await post("/signin", { login, password }, 204);
}

test("captures IAM and Notifications email and restores access after cancellation", async () => {
  await smoke("http://127.0.0.1:3000", "http://127.0.0.1:8025");
});
