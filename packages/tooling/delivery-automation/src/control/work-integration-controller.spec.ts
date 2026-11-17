import { describe, expect, it } from "vitest";

import {
  executeWorkIntegrationOperation,
  reconcileWorkIntegrationOperation,
  type WorkIntegrationReservationReceipt,
} from "./work-integration-controller.js";

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};

function fixture(
  initial: WorkIntegrationReservationReceipt["reservation"]["state"] = {
    phase: "queued",
    checkId: 17,
  },
) {
  let receipt: WorkIntegrationReservationReceipt = {
    revision: 1,
    reservation: { candidate, state: initial },
  };
  const effects: string[] = [];
  const ports: Parameters<typeof executeWorkIntegrationOperation>[0]["ports"] =
    {
      readReservation: async () => receipt,
      authorize: async () => true,
      append: async (previous, reservation) => {
        if (previous.revision !== receipt.revision) {
          return null;
        }
        receipt = { revision: previous.revision + 1, reservation };
        return receipt;
      },
      perform: async ({ reservation }) => {
        effects.push(reservation.state.phase);
        return { kind: "squash-armed", checkId: 17 };
      },
    };
  return { ports, effects, current: () => receipt };
}

describe("Work integration controller", () => {
  it("does not access credentials or the journal with standing disabled", async () => {
    const { ports, effects } = fixture();
    const result = await executeWorkIntegrationOperation({
      candidate,
      operation: "arm-squash",
      ports: {
        ...ports,
        readReservation: async () => {
          effects.push("read");
          return ports.readReservation();
        },
      },
    });
    expect(result.status).toBe("inactive");
    expect(effects).toEqual([]);
  });

  it("makes one external call only after winning the durable append", async () => {
    const { ports, effects, current } = fixture();
    const input = {
      candidate,
      operation: "arm-squash",
      standingEnabled: true,
      ports,
    } as const;
    const results = await Promise.all([
      executeWorkIntegrationOperation(input),
      executeWorkIntegrationOperation(input),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "confirmed",
      "deferred",
    ]);
    expect(effects).toEqual(["pending"]);
    expect(current().reservation.state).toEqual({
      phase: "armed",
      checkId: 17,
    });
  });

  it("leaves an uncertain arm pending and does not retry it", async () => {
    const { ports, effects, current } = fixture();
    const input = {
      candidate,
      operation: "arm-squash",
      standingEnabled: true,
      ports: {
        ...ports,
        perform: async () => {
          effects.push("uncertain arm");
          throw new Error("response lost");
        },
      },
    } as const;
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect(current().reservation.state.phase).toBe("pending");
    expect(effects).toEqual(["uncertain arm"]);
  });

  it("rechecks authority after the append before invoking the provider", async () => {
    const { ports, effects, current } = fixture();
    let authorizationReads = 0;
    const result = await executeWorkIntegrationOperation({
      candidate,
      operation: "arm-squash",
      standingEnabled: true,
      ports: {
        ...ports,
        authorize: async () => ++authorizationReads === 1,
      },
    });
    expect(result.status).toBe("denied");
    expect(current().reservation.state.phase).toBe("pending");
    expect(effects).toEqual([]);
  });

  it("reconciles a pending intent by read-only observation under recovery authority", async () => {
    const { ports, effects, current } = fixture();
    await executeWorkIntegrationOperation({
      candidate,
      operation: "arm-squash",
      standingEnabled: true,
      ports: { ...ports, perform: async () => null },
    });
    const recovery = {
      candidate,
      ports: {
        ...ports,
        authorize: async ({ operation }: { operation: string }) => {
          expect(operation).toBe("resolve");
          return true;
        },
        observe: async (intent: WorkIntegrationReservationReceipt) => {
          expect(intent.revision).toBe(2);
          return { kind: "squash-armed", checkId: 17 } as const;
        },
      },
    };
    const results = await Promise.all([
      reconcileWorkIntegrationOperation(recovery),
      reconcileWorkIntegrationOperation(recovery),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "confirmed",
      "deferred",
    ]);
    expect(current().reservation.state).toEqual({
      phase: "armed",
      checkId: 17,
    });
    expect(effects).toEqual([]);
  });

  it("keeps an unresolved intent pending when evidence or recovery authority is missing", async () => {
    const { ports, current } = fixture();
    await executeWorkIntegrationOperation({
      candidate,
      operation: "arm-squash",
      standingEnabled: true,
      ports: { ...ports, perform: async () => null },
    });
    for (const event of [
      null,
      { kind: "squash-armed", checkId: 18 },
    ] as const) {
      expect(
        (
          await reconcileWorkIntegrationOperation({
            candidate,
            ports: { ...ports, observe: async () => event },
          })
        ).status,
      ).toBe("deferred");
    }
    expect(
      (
        await reconcileWorkIntegrationOperation({
          candidate,
          ports: {
            ...ports,
            authorize: async () => false,
            observe: async () => {
              throw new Error("unexpected observation");
            },
          },
        })
      ).status,
    ).toBe("denied");
    expect(current().reservation.state.phase).toBe("pending");
  });
});

describe("merge-invalidating writes", () => {
  const writeId = "e".repeat(64);

  it("blocks an invalidating write while an armed request can still merge", async () => {
    for (const state of [
      { phase: "armed", checkId: 17 },
      { phase: "released", checkId: 17 },
      { phase: "pending", operation: "resolve", checkId: 17 },
      { phase: "merged", sha: "d".repeat(40) },
    ] as const) {
      const { ports, effects } = fixture(state);
      const result = await executeWorkIntegrationOperation({
        candidate,
        operation: "invalidate",
        writeId,
        standingEnabled: true,
        ports,
      });
      expect(result.status).toBe("deferred");
      expect(effects).toEqual([]);
    }
  });

  it("grants the write only to the winner of the durable invalidation intent", async () => {
    const { ports, effects, current } = fixture({ phase: "cancelled" });
    const input = {
      candidate,
      operation: "invalidate",
      writeId,
      standingEnabled: true,
      ports: {
        ...ports,
        perform: async ({ reservation }: WorkIntegrationReservationReceipt) => {
          effects.push(reservation.state.phase);
          return { kind: "invalidation-applied", writeId } as const;
        },
      },
    } as const;
    const results = await Promise.all([
      executeWorkIntegrationOperation(input),
      executeWorkIntegrationOperation({ ...input, writeId: "f".repeat(64) }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "confirmed",
      "deferred",
    ]);
    expect(effects).toEqual(["invalidating"]);
    expect(current().reservation.state).toEqual({
      phase: "invalidated",
      writeId,
    });
  });

  it("keeps an uncertain write pending until observing that exact command", async () => {
    const { ports, current } = fixture({ phase: "cancelled" });
    const input = {
      candidate,
      operation: "invalidate",
      writeId,
      standingEnabled: true,
      ports: { ...ports, perform: async () => null },
    } as const;
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect(current().reservation.state).toEqual({
      phase: "invalidating",
      writeId,
    });
    const result = await reconcileWorkIntegrationOperation({
      candidate,
      ports: {
        ...ports,
        authorize: async (request) => {
          expect(request).toEqual({ candidate, operation: "resolve", writeId });
          return true;
        },
        observe: async () => ({
          kind: "invalidation-applied",
          writeId: "f".repeat(64),
        }),
      },
    });
    expect(result.status).toBe("deferred");
    expect(current().reservation.state).toEqual({
      phase: "invalidating",
      writeId,
    });
  });
});

describe("durable final release admission", () => {
  const evidence = "a".repeat(64);

  function releaseFixture() {
    const { ports, current } = fixture({ phase: "armed", checkId: 17 });
    let authority: { identity: string; expiresAt: number } | null = {
      identity: "accepted delegation",
      expiresAt: Date.now() + 60_000,
    };
    const effects: string[] = [];
    const release = {
      candidate,
      operation: "release-check",
      standingEnabled: true,
      ports: {
        ...ports,
        readReleaseAuthority: async () => authority,
        perform: async (
          _intent: WorkIntegrationReservationReceipt,
          admit: (digest: string) => Promise<number | null>,
        ) => {
          if (!(await admit(evidence))) {
            return null;
          }
          effects.push("PATCH");
          return { kind: "check-released", checkId: 17 } as const;
        },
      },
    } as const;
    return {
      release,
      effects,
      current,
      setAuthority: (next: typeof authority | null) => {
        authority = next;
      },
    };
  }

  it.each([null, 0])(
    "defers a release without current delegation (%s)",
    async (expiresAt) => {
      const { release, effects, current, setAuthority } = releaseFixture();
      setAuthority(
        expiresAt === null ? null : { identity: "expired", expiresAt },
      );
      expect((await executeWorkIntegrationOperation(release)).status).toBe(
        "deferred",
      );
      expect(current().reservation.state).not.toHaveProperty(
        "releaseAdmission",
      );
      expect(effects).toEqual([]);
    },
  );

  it("blocks a known-unstarted operation when authority changes during the append", async () => {
    const { release, effects, current, setAuthority } = releaseFixture();
    const input = {
      ...release,
      ports: {
        ...release.ports,
        append: async (...args: Parameters<typeof release.ports.append>) => {
          const receipt = await release.ports.append(...args);
          if (
            receipt?.reservation.state.phase === "pending" &&
            receipt.reservation.state.releaseAdmission
          ) {
            setAuthority(null);
          }
          return receipt;
        },
      },
    };
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect(current().reservation.state).toHaveProperty("releaseAdmission");
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect(effects).toEqual([]);
  });

  it("records completion after revocation of a release which already started", async () => {
    const { release, effects, current, setAuthority } = releaseFixture();
    const input = {
      ...release,
      ports: {
        ...release.ports,
        perform: async (
          _intent: WorkIntegrationReservationReceipt,
          admit: (digest: string) => Promise<number | null>,
        ) => {
          expect(await admit(evidence)).toBeGreaterThan(Date.now());
          expect(await admit(evidence)).toBeNull();
          effects.push("PATCH");
          setAuthority(null);
          return { kind: "check-released", checkId: 17 } as const;
        },
      },
    };
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "confirmed",
    );
    expect(current().reservation.state).toEqual({
      phase: "released",
      checkId: 17,
    });
    expect(effects).toEqual(["PATCH"]);
  });

  it("does not dispatch again after a lost response and reconciles only by observation", async () => {
    const { release, effects, current, setAuthority } = releaseFixture();
    const input = {
      ...release,
      ports: {
        ...release.ports,
        perform: async (
          _intent: WorkIntegrationReservationReceipt,
          admit: (digest: string) => Promise<number | null>,
        ) => {
          expect(await admit(evidence)).toBeGreaterThan(Date.now());
          effects.push("PATCH");
          throw new Error("response lost");
        },
      },
    };
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    setAuthority(null);
    expect((await executeWorkIntegrationOperation(input)).status).toBe(
      "deferred",
    );
    expect(effects).toEqual(["PATCH"]);
    expect(
      (
        await reconcileWorkIntegrationOperation({
          candidate,
          ports: {
            ...release.ports,
            observe: async () => ({
              kind: "squash-merged",
              sha: "c".repeat(40),
            }),
          },
        })
      ).status,
    ).toBe("confirmed");
    expect(current().reservation.state.phase).toBe("merged");
  });
});
