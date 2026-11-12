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

function fixture() {
  let receipt: WorkIntegrationReservationReceipt = {
    revision: 1,
    reservation: { candidate, state: { phase: "queued", checkId: 17 } },
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
