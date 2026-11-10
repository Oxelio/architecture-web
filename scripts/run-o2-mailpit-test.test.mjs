import assert from "node:assert/strict";
import { test } from "node:test";

import { runMailpitFixture } from "./run-o2-mailpit-test.mjs";

function fixture({ adjust, failure, internal = true, remains = false } = {}) {
  const project = "aw-o2-fixture-test";
  const calls = [];
  const logs = [];
  const storage = {
    api: "/tmp",
    mailpit: "/tmp",
    postgres: "/var/lib/postgresql",
    redis: "/data",
  };
  async function execute(command, args, { signal }) {
    assert.equal(command, "docker");
    calls.push(args);
    if (args[0] === "compose") {
      assert.deepEqual(args.slice(1, 5), [
        "-p",
        project,
        "-f",
        "compose.o2-mailpit-test.yml",
      ]);
      if (args[5] === failure) throw new Error("synthetic raw diagnostic");
      if (args[5] === "ps") return { stdout: args[7] };
      if (args[5] === "exec") {
        assert.deepEqual(args.slice(6), [
          "-T",
          "api",
          "node",
          "--test",
          "/app/scripts/o2-mailpit-smoke.test.mjs",
        ]);
      }
      if (args[5] === "up" && failure === "watchdog") {
        return new Promise((resolve, reject) => {
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
      const container = {
        HostConfig: {
          LogConfig: { Type: "none" },
          Tmpfs: { [storage[service]]: "" },
          PortBindings: {},
          NetworkMode: "container:mailpit",
        },
        Mounts: [{ Type: "tmpfs" }],
        NetworkSettings: { Networks: { [`${project}_default`]: {} } },
      };
      if (service === "api") adjust?.(container);
      return { stdout: JSON.stringify([container]) };
    }
    assert.ok(args.includes(`label=com.docker.compose.project=${project}`));
    return { stdout: remains && args[0] === "ps" ? "remaining-container" : "" };
  }
  return {
    calls,
    logs,
    run: (options = {}) =>
      runMailpitFixture({
        project,
        execute,
        log: (line) => logs.push(line),
        ...options,
      }),
  };
}

function assertTeardown(calls) {
  const down = calls.findIndex((args) => args[5] === "down");
  assert.ok(down >= 0);
  assert.deepEqual(calls[down].slice(6), [
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
    if (mode)
      assert.ok(logs.includes(`Verified fixture ${mode.slice(2)} path`));
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
  for (const adjust of [
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
  ]) {
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
