import { Result } from "@architecture/foundation";
import { describe, expect, it, vi } from "vitest";

import { ClientApplication } from "#domain/delegated-authorization/client-application.entity";
import { SessionEntity } from "#domain/entities/session.entity";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  ClientAdministration,
  type ClientAdministrationTransaction,
} from "./client-administration.js";

function fixture() {
  let now = 100;
  const userId = UserIdentifierValueObject.generate();
  const session = SessionEntity.createForUser({
    userId,
    userSessionVersion: 1,
    expiresAt: new Date(Date.now() + 120_000),
  });
  const client = ClientApplication.register("synthetic", "Synthetic");
  if (!client.success) {
    throw new Error("Expected successful fixture registration");
  }
  const state = {
    comparison: "original",
    sessionVersion: 1,
    mfaEnabled: false,
    mfaRequired: false,
  };
  const transaction: ClientAdministrationTransaction = {
    adminSessionVersion: vi.fn(async () => 1),
    security: vi.fn(async () => ({ ...state })),
    reserveAttempt: vi.fn(async () => true),
    clients: vi.fn(async () => [client.value.state]),
    client: vi.fn(async () => client.value),
    publicIdExists: vi.fn(async () => false),
    save: vi.fn(async () => undefined),
  };
  const auth = { password: vi.fn(async () => Result.success(undefined)) };
  const secondFactor = {
    verify: vi.fn(async () => Result.success("backup_code" as const)),
  };
  const sessions = {
    findById: vi.fn(async () => session as SessionEntity | null),
  };
  const operations = new ClientAdministration(
    {
      run: (_input, execute) => execute(transaction),
    },
    [],
    sessions,
    auth,
    secondFactor,
    () => now,
  );
  const command = {
    actor: { accountId: userId.value, sessionId: session.identifier.value },
    clientId: client.value.state.id,
    expectedRevision: 0,
    command: {
      kind: "configure" as const,
      redirectUris: ["https://example.test/callback"],
      policies: [],
    },
    confirmation: { password: "a fixture password", mfaCode: "TEST-CODE" },
    startedAt: now,
  };
  return {
    operations,
    transaction,
    command,
    state,
    auth,
    secondFactor,
    sessions,
    session,
    advance: (elapsed: number) => {
      now += elapsed;
    },
  };
}

describe("approved client administration confirmation", () => {
  it("refuses at the two-minute deadline even after the password has been accepted", async () => {
    const f = fixture();
    f.auth.password.mockImplementation(async () => {
      f.advance(120_000);
      return Result.success(undefined);
    });
    expect(await f.operations.change(f.command)).toEqual({
      success: false,
      error: { code: "confirmation_refused" },
    });
    expect(f.transaction.reserveAttempt).toHaveBeenCalledOnce();
    expect(f.transaction.save).not.toHaveBeenCalled();
  });

  it("compares the same operation with a fresh session and security snapshot after factor verification", async () => {
    const f = fixture();
    f.state.mfaEnabled = true;
    f.secondFactor.verify.mockImplementation(async () => {
      f.state.comparison = "new credential identities";
      return Result.success("backup_code");
    });
    expect(await f.operations.change(f.command)).toMatchObject({
      success: false,
      error: { code: "confirmation_refused" },
    });
    expect(f.secondFactor.verify).toHaveBeenCalledWith(
      f.command.actor.accountId,
      "TESTCODE",
    );
    expect(f.transaction.save).not.toHaveBeenCalled();
  });

  it("rejects session loss after verification and saves once when the same credentials remain valid", async () => {
    const f = fixture();
    f.sessions.findById
      .mockResolvedValueOnce(f.session)
      .mockResolvedValueOnce(null);
    expect(await f.operations.change(f.command)).toMatchObject({
      success: false,
      error: { code: "session_invalid" },
    });
    expect(f.transaction.save).not.toHaveBeenCalled();
    expect(await f.operations.change(f.command)).toMatchObject({
      success: true,
      value: { revision: 1 },
    });
    expect(f.transaction.save).toHaveBeenCalledOnce();
  });

  it("requires current MFA before admitting a confirmation and skips verification for unchanged commands", async () => {
    const f = fixture();
    f.state.mfaRequired = true;
    expect(await f.operations.change(f.command)).toMatchObject({
      success: false,
      error: { code: "confirmation_refused" },
    });
    expect(
      await f.operations.change({ ...f.command, command: { kind: "disable" } }),
    ).toMatchObject({ success: true, value: { revision: 0 } });
    expect(f.transaction.reserveAttempt).not.toHaveBeenCalled();
    expect(f.auth.password).not.toHaveBeenCalled();
    expect(f.transaction.save).not.toHaveBeenCalled();
  });
});
