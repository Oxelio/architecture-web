import { expect, it, vi } from "vitest";

import { AuthorizationGrant } from "#domain/delegated-authorization/authorization-grant.entity";
import {
  ClientApplication,
  type ProtectedResource,
} from "#domain/delegated-authorization/client-application.entity";

import type { DelegatedAuthorizationWriter } from "./delegated-authorization.contracts.js";
import { delegatedAuthorizationApplication } from "./delegated-authorization.js";

const resource: ProtectedResource = {
  id: "resource",
  uri: "https://resource.example.test/",
  permissions: [
    { code: "read", description: "Read" },
    { code: "write", description: "Write" },
  ],
};

function fixture() {
  const registered = ClientApplication.register("client", "Synthetic client");
  if (!registered.success) {
    throw new Error("Expected client registration");
  }
  const client = ClientApplication.rehydrate({
    ...registered.value.state,
    enabled: true,
    policies: [
      { resourceId: resource.id, required: ["read"], optional: ["write"] },
    ],
  });
  const request = {
    accountId: "account",
    clientId: client.state.id,
    resourceId: resource.id,
    clientRevision: 0,
    requested: ["read", "write"],
  };
  const initialGrant = AuthorizationGrant.authorize(
    request,
    ["read", "write"],
    new Date(),
  );
  let stored = initialGrant;
  const writer = {
    eligibleAccount: vi.fn(async (id) => id === request.accountId),
    client: vi.fn(async (id) => (id === client.state.id ? client : undefined)),
    grant: vi.fn(async (accountId, id) =>
      accountId === stored.state.accountId && id === stored.state.id
        ? stored
        : undefined,
    ),
    activeGrant: vi.fn(async () => stored),
    grants: vi.fn(async () => [stored]),
    freshness: vi.fn(async () => ({ accountEpoch: "0", tupleEpoch: "0" })),
    saveClient: vi.fn(),
    saveGrant: vi.fn(async (grant) => {
      stored = grant;
    }),
    invalidateConsent: vi
      .fn<DelegatedAuthorizationWriter["invalidateConsent"]>()
      .mockResolvedValue(undefined),
    saveGrantRestriction: vi.fn<
      DelegatedAuthorizationWriter["saveGrantRestriction"]
    >(async (grant) => {
      stored = grant;
    }),
    revokeAccountGrants: vi
      .fn<DelegatedAuthorizationWriter["revokeAccountGrants"]>()
      .mockResolvedValue(undefined),
  } satisfies DelegatedAuthorizationWriter;
  const application = delegatedAuthorizationApplication({
    resources: [resource],
    store: {
      read: (run) => run(writer),
      write: (_accountId, run) => run(writer),
    },
  });
  return { application, request, writer, initialGrant };
}

it("projects recognized permissions and gives a read-only family without shrinking the grant", async () => {
  const f = fixture();
  const result = await f.application.prepareConsent.execute(f.request);
  if (!result.success) {
    throw new Error(result.error.code);
  }
  expect(result.value.required.map(({ code }) => code)).toEqual(["read"]);
  expect(result.value.optional.map(({ code }) => code)).toEqual(["write"]);
  const auth = await f.application.finalizeConsent.execute({
    consent: result.value,
    selected: ["read"],
    sessionIsCurrent: async () => true,
    expiresAt: new Date(Date.now() + 30_000),
  });
  if (!auth.success) {
    throw new Error(auth.error.code);
  }
  expect(auth.value.entitlements.map(({ code }) => code)).toEqual(["read"]);
  expect(f.writer.saveGrant).not.toHaveBeenCalled();
  expect(
    await f.application.admit.execute({
      credential: auth.value,
      intendedResourceId: resource.id,
      permission: "read",
      scope: [],
    }),
  ).toMatchObject({ success: false });
});

it("rejects unsupported requests and projects only the owning account's safe grant information", async () => {
  const f = fixture();
  expect(
    await f.application.prepareConsent.execute({
      ...f.request,
      requested: ["read", "unknown"],
    }),
  ).toMatchObject({ success: false });
  expect(
    await f.application.listGrants.execute({ accountId: "other-account" }),
  ).toMatchObject({ success: false });
  const connected = await f.application.listGrants.execute({
    accountId: f.request.accountId,
  });
  expect(connected).toEqual({
    success: true,
    value: [
      {
        id: f.initialGrant.state.id,
        clientId: f.request.clientId,
        applicationName: "Synthetic client",
        resourceId: resource.id,
        permissions: ["read", "write"],
        authorizedAt: f.initialGrant.state.authorizedAt,
        revokedAt: null,
      },
    ],
  });
});

it("withdraws and revokes only for the owner and invalidates consent once per actual mutation", async () => {
  const f = fixture();
  const target = {
    accountId: f.request.accountId,
    grantId: f.initialGrant.state.id,
  };
  expect(
    await f.application.revokeGrant.execute({
      ...target,
      accountId: "other-account",
    }),
  ).toMatchObject({ success: false });
  expect(
    await f.application.withdrawPermission.execute({
      ...target,
      permission: "write",
    }),
  ).toEqual({ success: true, value: true });
  expect(
    await f.application.withdrawPermission.execute({
      ...target,
      permission: "write",
    }),
  ).toEqual({ success: true, value: false });
  expect(await f.application.revokeGrant.execute(target)).toEqual({
    success: true,
    value: true,
  });
  expect(await f.application.revokeGrant.execute(target)).toEqual({
    success: true,
    value: false,
  });
  expect(f.writer.saveGrantRestriction).toHaveBeenCalledTimes(2);
});
