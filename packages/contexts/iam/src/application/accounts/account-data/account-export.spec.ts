import { describe, expect, it, vi } from "vitest";

import { RequestAccountExportUseCase } from "#accounts/request-account-export/request-account-export.use-case";
import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import { TestPolicies } from "#test/test-policies";
describe("account export orchestration", () => {
  it("records failed generation and propagates the original technical failure", async () => {
    const failure = new Error("database unavailable"),
      user = UserEntity.create(),
      fail = vi.fn(async () => undefined);
    const store = {
      reserve: async () => ({ id: "export", status: "pending", created: true }),
      readData: async () => {
        throw failure;
      },
      fail,
    };
    const useCase = new RequestAccountExportUseCase(
      new TestPolicies(),
      { strong: async () => ({ success: true, value: undefined }) } as never,
      store as never,
      { findActiveForUser: async () => [] } as never,
      { exportFor: async () => [] } as never,
      {} as never,
      { identifier: () => "export" } as never,
    );
    await expect(
      useCase.execute({
        userId: user.identifier.value,
        sessionId: "session",
        password: "password",
      }),
    ).rejects.toBe(failure);
    expect(fail).toHaveBeenCalledWith("export", expect.any(Date));
  });
  it("projects session metadata without exporting its bearer identifier", async () => {
    const user = UserEntity.create(),
      session = SessionEntity.createForUser({
        userId: user.identifier,
        userSessionVersion: 1,
        expiresAt: new Date(Date.now() + 60000),
      }),
      build = vi.fn(() => new Uint8Array([1]));
    const store = {
      reserve: async () => ({ id: "export", status: "pending", created: true }),
      readData: async () => ({
        account: { id: user.identifier.value },
        requests: { exports: [], deletions: [] },
      }),
      complete: vi.fn(),
    };
    const useCase = new RequestAccountExportUseCase(
      new TestPolicies(),
      { strong: async () => ({ success: true, value: undefined }) } as never,
      store as never,
      { findActiveForUser: async () => [session] } as never,
      { exportFor: async () => [] } as never,
      { build },
      { identifier: () => "export" } as never,
    );
    expect(
      (
        await useCase.execute({
          userId: user.identifier.value,
          sessionId: "session",
          password: "password",
        })
      ).success,
    ).toBe(true);
    expect(JSON.stringify(build.mock.calls)).not.toContain(
      session.identifier.value,
    );
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        "sessions.json": expect.stringContaining("expiresAt"),
      }),
    );
  });
});
