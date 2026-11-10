import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const run = promisify(execFile);
const cwd = fileURLToPath(new URL("../", import.meta.url));
const project = `aw-o2-${randomUUID()}`;
const compose = ["compose", "-p", project, "-f", "compose.o2-mailpit-test.yml"];
const controller = new AbortController();
const stop = () => controller.abort(new Error("Fixture interrupted"));
const timeout = () =>
  controller.abort(new Error("Fixture runtime limit reached"));
const watchdog = setTimeout(timeout, 30 * 60_000);
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function docker(args, signal) {
  try {
    const { stdout } = await run("docker", args, {
      cwd,
      signal,
      timeout: signal ? undefined : 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    signal?.throwIfAborted();
    throw new Error(`Docker operation failed (${args[0]} ${args[1] ?? ""})`);
  }
}

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3_000)]),
  });
}

async function waitFor(description, probe) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    controller.signal.throwIfAborted();
    try {
      const result = await probe();
      if (result) return result;
    } catch {
      controller.signal.throwIfAborted();
    }
    await sleep(500, undefined, { signal: controller.signal });
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
  console.log("Mailpit smoke passed for fictitious data");
}

async function cleanup() {
  await docker([
    ...compose,
    "down",
    "--volumes",
    "--rmi",
    "local",
    "--timeout",
    "5",
  ]);
  const filter = ["--filter", `label=com.docker.compose.project=${project}`];
  const remaining = await Promise.all([
    docker(["ps", "-aq", ...filter]),
    docker(["volume", "ls", "-q", ...filter]),
    docker(["network", "ls", "-q", ...filter]),
  ]);
  if (remaining.some(Boolean)) {
    throw new Error("Fixture resources remain after teardown");
  }
  console.log(`Verified fixture teardown for ${project}`);
}

async function verifyIsolation() {
  const signal = controller.signal;
  const network = await docker(
    ["network", "inspect", "--format", "{{.Internal}}", `${project}_default`],
    signal,
  );
  if (network !== "true") throw new Error("Fixture network must be internal");
  const storage = {
    api: "/tmp",
    mailpit: "/tmp",
    postgres: "/var/lib/postgresql",
    redis: "/data",
  };
  await Promise.all(
    Object.entries(storage).map(async ([service, path]) => {
      const id = await docker([...compose, "ps", "-q", service], signal);
      const [container] = JSON.parse(await docker(["inspect", id], signal));
      if (
        container.HostConfig.LogConfig.Type !== "none" ||
        Object.keys(container.HostConfig.PortBindings ?? {}).length !== 0 ||
        !Object.hasOwn(container.HostConfig.Tmpfs ?? {}, path) ||
        container.Mounts.some((mount) => mount.Type !== "tmpfs") ||
        Object.keys(container.NetworkSettings.Networks).join() !==
          `${project}_default`
      ) {
        throw new Error(`Fixture isolation check failed for ${service}`);
      }
    }),
  );
}

async function runFixture(mode) {
  try {
    await docker(
      [...compose, "up", "--build", "-d", "--wait", "--wait-timeout", "90"],
      controller.signal,
    );
    await verifyIsolation();
    const output = await docker(
      [
        ...compose,
        "exec",
        "-T",
        "api",
        "node",
        "/app/scripts/run-o2-mailpit-test.mjs",
        "--in-container",
      ],
      controller.signal,
    );
    if (output !== "Mailpit smoke passed for fictitious data") {
      throw new Error("Fixture did not report a successful smoke");
    }
    console.log(output);
    if (mode === "--abort") stop();
    if (mode === "--timeout") timeout();
    controller.signal.throwIfAborted();
  } catch (error) {
    if (!mode || error !== controller.signal.reason) throw error;
  } finally {
    await cleanup();
  }
}

try {
  const mode = process.argv[2];
  if (process.argv.length > 3) {
    throw new Error(
      "Use node scripts/run-o2-mailpit-test.mjs [--abort|--timeout]",
    );
  }
  if (mode === "--in-container") {
    await smoke("http://127.0.0.1:3000", "http://mailpit:8025");
  } else if (mode === undefined || mode === "--abort" || mode === "--timeout") {
    await runFixture(mode);
  } else {
    throw new Error(
      "Use node scripts/run-o2-mailpit-test.mjs [--abort|--timeout]",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Fixture failed");
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
