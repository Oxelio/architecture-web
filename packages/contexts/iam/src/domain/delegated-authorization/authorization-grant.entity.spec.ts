import { describe, expect, it } from "vitest";

import { AuthorizationGrant } from "./authorization-grant.entity.js";
import {
  ClientApplication,
  type ProtectedResource,
} from "./client-application.entity.js";

const target = {
  accountId: "account",
  clientId: "client",
  resourceId: "resource",
};
const now = new Date("2026-01-01T00:00:00Z");

describe("delegated authorization aggregates", () => {
  it("registers a disabled client with an identity independent of its name", () => {
    const first = ClientApplication.register("first", "Application");
    const second = ClientApplication.register("second", "Application");
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) {
      throw new Error("Expected two registrations");
    }
    expect(first.value.state.enabled).toBe(false);
    expect(first.value.state.id).not.toBe(second.value.state.id);
    expect(ClientApplication.register("", "Application").success).toBe(false);
  });

  it("rejects stored client policy with unknown or multiply classified permissions", () => {
    const resource: ProtectedResource = {
      id: "resource",
      uri: "https://resource.example.test/",
      permissions: [{ code: "read", description: "Read" }],
    };
    const registered = ClientApplication.register(
      "public-client",
      "Application",
    );
    if (!registered.success) {
      throw new Error("Expected registration");
    }
    for (const optional of [["read"], ["unknown"]]) {
      const client = ClientApplication.rehydrate({
        ...registered.value.state,
        policies: [{ resourceId: resource.id, required: ["read"], optional }],
      });
      expect(client.policyFor(resource)).toBeUndefined();
    }
  });

  it("preserves unaffected permissions and gives regranted permissions new generations", () => {
    const first = AuthorizationGrant.authorize(target, ["read", "write"], now);
    const restricted = first.withdraw("write", ["read"], now);
    const regranted = restricted.extend(["read", "write"]);
    expect(regranted.state.id).toBe(first.state.id);
    expect(
      regranted
        .currentEntitlements(["read", "write"], first.state.permissions)
        .map(({ code }) => code),
    ).toEqual(["read"]);
    expect(
      regranted.state.permissions.find(({ code }) => code === "write"),
    ).not.toEqual(first.state.permissions.find(({ code }) => code === "write"));
  });

  it("revokes on required permission withdrawal without restoring an old lifecycle", () => {
    const first = AuthorizationGrant.authorize(target, ["read"], now);
    const revoked = first.withdraw("read", ["read"], now);
    expect(revoked.state.revokedAt).toEqual(now);
    expect(revoked.revoke(now)).toBe(revoked);
    expect(revoked.extend(["read"])).toBe(revoked);
    expect(
      revoked.currentEntitlements(["read"], first.state.permissions),
    ).toEqual([]);
    expect(
      AuthorizationGrant.authorize(target, ["read"], now).state.id,
    ).not.toBe(first.state.id);
  });
});
