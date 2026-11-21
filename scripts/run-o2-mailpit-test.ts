import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

interface DockerExecutionOptions {
  cwd: string;
  signal?: AbortSignal;
  timeout?: number;
  maxBuffer: number;
}

export type DockerExecutor = (
  command: string,
  args: string[],
  options: DockerExecutionOptions,
) => Promise<{ stdout: string }>;

type DockerCommand = (
  args: string[],
  signal?: AbortSignal,
) => Promise<string>;

export interface MailpitFixtureOptions {
  mode?: string | undefined;
  project?: string;
  execute?: DockerExecutor;
  log?: (message: string) => void;
  watchdogMs?: number | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const executeFile = promisify(execFile);
const cwd = fileURLToPath(new URL("../", import.meta.url));
const fixtureStorage = {
  api: "/tmp",
  mailpit: "/tmp",
  postgres: "/var/lib/postgresql",
  redis: "/data",
};

async function verifyIsolation(
  docker: DockerCommand,
  compose: string[],
  project: string,
  signal: AbortSignal,
) {
  const networkName = `${project}_default`;
  const network = await docker(
    ["network", "inspect", "--format", "{{.Internal}}", networkName],
    signal,
  );
  if (network !== "true") {
    throw new Error("Fixture network must be internal");
  }
  const mailpitId = await docker([...compose, "ps", "-q", "mailpit"], signal);
  await Promise.all(
    Object.entries(fixtureStorage).map(async ([service, path]) => {
      const id =
        service === "mailpit"
          ? mailpitId
          : await docker([...compose, "ps", "-q", service], signal);
      const containers: unknown = JSON.parse(
        await docker(["inspect", id], signal),
      );
      const container: unknown = Array.isArray(containers)
        ? containers[0]
        : undefined;
      if (!isRecord(container)) {
        throw new Error(`Fixture isolation check failed for ${service}`);
      }
      const host = container["HostConfig"];
      const mounts = container["Mounts"];
      const settings = container["NetworkSettings"];
      if (!isRecord(host) || !Array.isArray(mounts)) {
        throw new Error(`Fixture isolation check failed for ${service}`);
      }
      const logConfig = host["LogConfig"];
      const networks = isRecord(settings) ? settings["Networks"] : undefined;
      const connected =
        service === "api"
          ? host["NetworkMode"] === `container:${mailpitId}`
          : isRecord(networks) &&
            Object.keys(networks).join() === networkName;
      if (
        !isRecord(logConfig) ||
        logConfig["Type"] !== "none" ||
        Object.keys(host["PortBindings"] ?? {}).length !== 0 ||
        !Object.hasOwn(host["Tmpfs"] ?? {}, path) ||
        mounts.some(
          (mount: unknown) => !isRecord(mount) || mount["Type"] !== "tmpfs",
        ) ||
        !connected
      ) {
        throw new Error(`Fixture isolation check failed for ${service}`);
      }
    }),
  );
}

async function cleanup(
  docker: DockerCommand,
  compose: string[],
  project: string,
) {
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
}

export async function runMailpitFixture({
  mode,
  project = `aw-o2-${randomUUID()}`,
  execute = executeFile,
  log = console.log,
  watchdogMs = 30 * 60_000,
}: MailpitFixtureOptions = {}) {
  if (mode !== undefined && !["--abort", "--timeout"].includes(mode)) {
    throw new Error(
      "Use node scripts/run-o2-mailpit-test.ts [--abort|--timeout]",
    );
  }
  const compose = [
    "compose",
    "-p",
    project,
    "-f",
    "compose.o2-mailpit-test.yml",
  ];
  const controller = new AbortController();
  const { signal } = controller;
  const stop = () => controller.abort(new Error("Fixture interrupted"));
  const timeout = () =>
    controller.abort(new Error("Fixture runtime limit reached"));
  const watchdog = setTimeout(timeout, watchdogMs);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  async function docker(args: string[], activeSignal?: AbortSignal) {
    try {
      const { stdout } = await execute("docker", args, {
        cwd,
        ...(activeSignal ? { signal: activeSignal } : { timeout: 60_000 }),
        maxBuffer: 8 * 1024 * 1024,
      });
      return stdout.trim();
    } catch {
      activeSignal?.throwIfAborted();
      throw new Error(`Docker operation failed (${args[0]} ${args[1] ?? ""})`);
    }
  }

  let smokePassed = false;
  try {
    await docker(
      [...compose, "up", "--build", "-d", "--wait", "--wait-timeout", "90"],
      signal,
    );
    await verifyIsolation(docker, compose, project, signal);
    await docker(
      [
        ...compose,
        "exec",
        "-T",
        "api",
        "node",
        "--test",
        "/app/scripts/o2-mailpit-smoke.test.ts",
      ],
      signal,
    );
    smokePassed = true;
    log("Mailpit smoke passed for fictitious data");
    if (mode === "--abort") {
      stop();
    }
    if (mode === "--timeout") {
      timeout();
    }
    signal.throwIfAborted();
  } catch (error) {
    if (!smokePassed || !mode || error !== signal.reason) {
      throw error;
    }
    log(`Verified fixture ${mode.slice(2)} path`);
  } finally {
    clearTimeout(watchdog);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await cleanup(docker, compose, project);
    log(`Verified fixture teardown for ${project}`);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length > 3) {
      throw new Error(
        "Use node scripts/run-o2-mailpit-test.ts [--abort|--timeout]",
      );
    }
    await runMailpitFixture({ mode: process.argv[2] });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Fixture failed");
    process.exitCode = 1;
  }
}
