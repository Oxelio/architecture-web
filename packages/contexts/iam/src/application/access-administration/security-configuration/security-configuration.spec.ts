import { describe, expect, it, vi } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import { GetSecurityConfigurationUseCase } from "#access-administration/get-security-configuration/get-security-configuration.use-case";
import { PreviewSecurityConfigurationUseCase } from "#access-administration/preview-security-configuration/preview-security-configuration.use-case";
import { PublishSecurityConfigurationUseCase } from "#access-administration/publish-security-configuration/publish-security-configuration.use-case";
import {
  DEFAULT_SECURITY_POLICY,
  parseSecurityPolicy,
} from "#domain/security-policy";
import { UserEntity } from "#entities/user.entity";
import { InMemoryUserRepository } from "#test/in-memory-repositories";

import type { ConfigurationStore } from "./configuration.store.js";
async function fixture(admin = true) {
  const users = new InMemoryUserRepository(),
    actor = admin ? createAdministrator() : UserEntity.create();
  await users.save(actor);
  const revision = {
    id: "revision",
    version: 3,
    values: structuredClone(DEFAULT_SECURITY_POLICY),
    createdBy: actor.identifier.value,
    createdAt: new Date(),
    previousRevisionId: null,
  };
  const store = {
    readPublished: vi.fn(async () => revision),
    readCenter: async (): ReturnType<ConfigurationStore["readCenter"]> => ({
      published: await store.readPublished(),
      revisions: await store.history(),
    }),
    history: vi.fn(async () => [revision]),
    countAdministratorsWithoutMfa: vi.fn(async () => 2),
    publish: vi.fn(
      async (input: Parameters<ConfigurationStore["publish"]>[0]) =>
        input.expectedVersion === revision.version
          ? { ...revision, version: 4, values: input.values }
          : null,
    ),
    find: vi.fn(),
    initialize: vi.fn(),
  } satisfies ConfigurationStore;
  return {
    store,
    authorization: new AdministratorAuthorizer(users),
    actorId: actor.identifier.value,
    revision,
  };
}
describe("security configuration administration", () => {
  it("binds effective values to their own revision when history advances", async () => {
    const f = await fixture();
    f.store.history.mockResolvedValue([{ ...f.revision, version: 99 }]);
    const result = await new GetSecurityConfigurationUseCase(
      f.authorization,
      f.store,
    ).execute(f.actorId);
    expect(result).toMatchObject({
      success: true,
      value: {
        effectiveRevision: { id: f.revision.id, version: 3 },
        revisions: [{ version: 99 }],
      },
    });
    expect(f.store.readPublished).toHaveBeenCalledOnce();
  });
  it("authorizes against the persisted actor before reading configuration", async () => {
    const f = await fixture(false);
    const result = await new GetSecurityConfigurationUseCase(
      f.authorization,
      f.store,
    ).execute(f.actorId);
    expect(result.success).toBe(false);
    expect(f.store.readPublished).not.toHaveBeenCalled();
  });
  it("previews one snapshot and carries the actual before/after values", async () => {
    const f = await fixture();
    const values = structuredClone(DEFAULT_SECURITY_POLICY);
    values.sessions.durationMinutes = 600;
    const result = await new PreviewSecurityConfigurationUseCase(
      f.authorization,
      f.store,
    ).execute({ actorId: f.actorId, values });
    expect(result).toMatchObject({
      success: true,
      value: {
        changes: [
          { key: "sessions.durationMinutes", before: 43200, after: 600 },
        ],
      },
    });
    expect(f.store.readPublished).toHaveBeenCalledOnce();
  });
  it("refuses critical publication without explicit confirmation", async () => {
    const f = await fixture();
    const values = structuredClone(DEFAULT_SECURITY_POLICY);
    values.passwords.privilegedMinLength = 21;
    const result = await new PublishSecurityConfigurationUseCase(
      f.authorization,
      f.store,
      { strong: async () => ({ success: true as const, value: 1 }) },
      { record: async () => undefined },
    ).execute({
      actorId: f.actorId,
      values,
      expectedVersion: 3,
      justification: "Increase minimum",
      confirmedCritical: false,
    });
    expect(result).toEqual({
      success: false,
      error: { code: "security_configuration.critical_confirmation_required" },
    });
    expect(f.store.publish).not.toHaveBeenCalled();
  });
  it("reports an atomic version conflict as an expected outcome", async () => {
    const f = await fixture();
    const result = await new PublishSecurityConfigurationUseCase(
      f.authorization,
      f.store,
      { strong: async () => ({ success: true as const, value: 1 }) },
      { record: async () => undefined },
    ).execute({
      actorId: f.actorId,
      values: DEFAULT_SECURITY_POLICY,
      expectedVersion: 2,
      justification: "Review policy",
      confirmedCritical: true,
    });
    expect(result).toEqual({
      success: false,
      error: { code: "security_configuration.version_conflict" },
    });
  });
  it("does not relabel persistence failures as business refusals", async () => {
    const f = await fixture(),
      failure = new Error("database unavailable");
    f.store.publish.mockRejectedValue(failure);
    await expect(
      new PublishSecurityConfigurationUseCase(
        f.authorization,
        f.store,
        { strong: async () => ({ success: true as const, value: 1 }) },
        { record: async () => undefined },
      ).execute({
        actorId: f.actorId,
        values: DEFAULT_SECURITY_POLICY,
        expectedVersion: 3,
        justification: "Review",
        confirmedCritical: true,
      }),
    ).rejects.toBe(failure);
  });
  it("rejects unknown keys, incomplete snapshots and invalid cross-field invariants", () => {
    expect(parseSecurityPolicy({ accounts: {} }).success).toBe(false);
    expect(
      parseSecurityPolicy({ ...DEFAULT_SECURITY_POLICY, obsolete: true })
        .success,
    ).toBe(false);
    expect(
      parseSecurityPolicy({
        ...DEFAULT_SECURITY_POLICY,
        passwords: {
          ...DEFAULT_SECURITY_POLICY.passwords,
          maxLength: 64,
          privilegedMinLength: 80,
        },
      }).success,
    ).toBe(false);
  });
  it("requires actual fresh proof even when the critical checkbox is true", async () => {
    const f = await fixture();
    const values = structuredClone(DEFAULT_SECURITY_POLICY);
    values.passwords.privilegedMinLength++;
    const strong = vi.fn(async () => ({
      success: false as const,
      error: { code: "authentication.recent_proof_required" as const },
    }));
    const result = await new PublishSecurityConfigurationUseCase(
      f.authorization,
      f.store,
      { strong },
      { record: async () => undefined },
    ).execute({
      actorId: f.actorId,
      values,
      expectedVersion: 3,
      justification: "Critical update",
      confirmedCritical: true,
    });
    expect(result).toEqual({
      success: false,
      error: { code: "authentication.recent_proof_required" },
    });
    expect(strong).toHaveBeenCalledOnce();
    expect(f.store.publish).not.toHaveBeenCalled();
  });
});
