import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type DockerExecutor,
  type MailpitFixtureOptions,
  runMailpitFixture,
} from "./run-o2-mailpit-test.ts";

interface InspectFixture {
  HostConfig: {
    LogConfig: { Type: string };
    Tmpfs?: Record<string, string>;
    PortBindings: Record<string, unknown>;
    NetworkMode: string;
  };
  Mounts: [{ Type: string }];
  NetworkSettings: { Networks: Record<string, object> };
}

interface FixtureOptions {
  adjust?: (container: InspectFixture) => void;
  failure?: string;
  internal?: boolean;
  remains?: boolean;
}

function fixture({
  adjust,
  failure,
  internal = true,
  remains = false,
}: FixtureOptions = {}) {
  const project = "aw-o2-fixture-test";
  const calls: string[][] = [];
  const logs: string[] = [];
  const storage: Record<string, string> = {
    api: "/tmp",
    mailpit: "/tmp",
    postgres: "/var/lib/postgresql",
    redis: "/data",
  };
  const execute: DockerExecutor = async (command, args, { signal }) => {
    assert.equal(command, "docker");
    calls.push(args);
    if (args[0] === "compose") {
      assert.deepEqual(args.slice(1, 5), [
        "-p",
        project,
        "-f",
        "compose.o2-mailpit-test.yml",
      ]);
      if (args[5] === failure) {
        throw new Error("synthetic raw diagnostic");
      }
      if (args[5] === "ps") {
        assert.ok(args[7]);
        return { stdout: args[7] };
      }
      if (args[5] === "exec") {
        assert.deepEqual(args.slice(6), [
          "-T",
          "api",
          "node",
          "--test",
          "/app/scripts/o2-mailpit-smoke.test.ts",
        ]);
      }
      if (args[5] === "up" && failure === "watchdog") {
        assert.ok(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      }
      return { stdout: "" };
    }
    if (args[0] === "network" && args[1] === "inspect") {
      return { stdout: String(internal) };
    }
    if (args[0] === "inspect") {
      const service = args[1];
      assert.ok(service);
      const path = storage[service];
      assert.ok(path);
      const container: InspectFixture = {
        HostConfig: {
          LogConfig: { Type: "none" },
          Tmpfs: { [path]: "" },
          PortBindings: {},
          NetworkMode: "container:mailpit",
        },
        Mounts: [{ Type: "tmpfs" }],
        NetworkSettings: { Networks: { [`${project}_default`]: {} } },
      };
      if (service === "api") {
        adjust?.(container);
      }
      return { stdout: JSON.stringify([container]) };
    }
    assert.ok(args.includes(`label=com.docker.compose.project=${project}`));
    return { stdout: remains && args[0] === "ps" ? "remaining-container" : "" };
  };
  return {
    calls,
    logs,
    run: (options: MailpitFixtureOptions = {}) =>
      runMailpitFixture({
        project,
        execute,
        log: (line) => logs.push(line),
        ...options,
      }),
  };
}

function assertTeardown(calls: string[][]) {
  const down = calls.findIndex((args) => args[5] === "down");
  assert.ok(down >= 0);
  assert.deepEqual(calls[down]?.slice(6), [
    "--volumes",
    "--rmi",
    "local",
    "--timeout",
    "5",
  ]);
  assert.equal(calls.slice(down + 1).length, 3);
}

for (const mode of [undefined, "--abort", "--timeout"]) {
  test(`verifies a successful fixture and tears down after ${mode ?? "normal completion"}`, async () => {
    const { calls, logs, run } = fixture();
    await run({ mode });
    assertTeardown(calls);
    assert.ok(logs.includes("Mailpit smoke passed for fictitious data"));
    if (mode) {
      assert.ok(logs.includes(`Verified fixture ${mode.slice(2)} path`));
    }
  });
}

test("tears down after startup, smoke or watchdog failure", async () => {
  for (const failure of ["up", "exec", "watchdog"]) {
    const { calls, run } = fixture({ failure });
    await assert.rejects(
      run({ watchdogMs: failure === "watchdog" ? 5 : undefined }),
      failure === "watchdog"
        ? /runtime limit reached/
        : /Docker operation failed/,
    );
    assertTeardown(calls);
  }
});

test("rejects a network without isolation and tears down", async () => {
  const { calls, run } = fixture({ internal: false });
  await assert.rejects(run(), /network must be internal/);
  assertTeardown(calls);
});

test("rejects retained logs, published ports, persistent mounts and wrong network membership", async () => {
  const adjustments: ((container: InspectFixture) => void)[] = [
    (container) => {
      container.HostConfig.LogConfig.Type = "json-file";
    },
    (container) => {
      container.HostConfig.PortBindings["3000/tcp"] = [];
    },
    (container) => {
      delete container.HostConfig.Tmpfs;
    },
    (container) => {
      container.Mounts[0].Type = "volume";
    },
    (container) => {
      container.HostConfig.NetworkMode = "bridge";
    },
  ];
  for (const adjust of adjustments) {
    const { calls, run } = fixture({ adjust });
    await assert.rejects(run(), /isolation check failed for api/);
    assertTeardown(calls);
  }
});

test("fails if verification finds fixture resources left after teardown", async () => {
  const { calls, run } = fixture({ remains: true });
  await assert.rejects(run(), /resources remain/);
  assertTeardown(calls);
});

test("rejects invalid modes before using Docker", async () => {
  const { calls, run } = fixture();
  await assert.rejects(
    run({ mode: "--unknown" }),
    /Use node scripts\/run-o2-mailpit-test/,
  );
  assert.deepEqual(calls, []);
});
