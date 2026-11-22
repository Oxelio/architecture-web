import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activateUser,
  assignUserRole,
  changeEmail,
  changePassword,
  getAccountDeletionDisclosure,
  requestAccountDeletion,
  listUsers,
  publishSecurityConfig,
  resendEmailVerification,
  revokeCurrentUserSession,
  revokeUserSession,
  rollbackSecurityConfig,
  signIn,
  signOut,
  signUp,
  suspendUser,
  verifyEmail,
} from "./api.js";

describe("IAM API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a successful sign-in response without a JSON body", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      signIn({
        login: { kind: "email", value: "alice@example.com" },
        password: "correct horse battery",
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["sign out", () => signOut()],
    ["change email", () => changeEmail({ email: "new@example.com" })],
    [
      "change password",
      () =>
        changePassword({
          currentPassword: "current password",
          password: "new correct horse battery",
          passwordConfirmation: "new correct horse battery",
        }),
    ],
    ["verify email", () => verifyEmail("verification-token")],
    ["resend email verification", () => resendEmailVerification()],
    ["revoke current session", () => revokeCurrentUserSession("session-123")],
    ["assign role", () => assignUserRole("user-123", "admin")],
    ["suspend user", () => suspendUser("user-123")],
    ["activate user", () => activateUser("user-123")],
    ["revoke user session", () => revokeUserSession("user-123", "session-123")],
  ])("accepts an empty successful response for %s", async (_name, command) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
      }),
    );

    await expect(command()).resolves.toBeUndefined();
  });

  it("fetches the authenticated effective deletion disclosure without HTTP caching", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: { enabled: true, gracePeriodDays: 30 } }),
    });
    vi.stubGlobal("fetch", fetch);

    await expect(getAccountDeletionDisclosure()).resolves.toEqual({
      enabled: true,
      gracePeriodDays: 30,
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/iam\/me\/deletion$/);
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
  });

  it("sends mandatory effective-duration confirmation without a legacy request shape", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: { scheduledFor: "2026-12-22T12:00:00Z" } }),
    });
    vi.stubGlobal("fetch", fetch);
    await requestAccountDeletion("proof-password", 30, "123456");
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/iam\/me\/deletion$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      password: "proof-password",
      confirmation: "DELETE",
      confirmedGracePeriodDays: 30,
      mfaCode: "123456",
    });
    expect(url).not.toContain("proof-password");
  });

  it("surfaces the changed-period application code without retrying deletion", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: { code: "account_deletion.grace_period_changed" },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    await expect(requestAccountDeletion("proof", 14)).rejects.toMatchObject({
      code: "account_deletion.grace_period_changed",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reads the created user identifier from a successful sign-up", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: { userId: "user-123" } }),
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      signUp({
        login: { kind: "email", value: "alice@example.com" },
        password: "correct horse battery",
        passwordConfirmation: "correct horse battery",
      }),
    ).resolves.toEqual({ userId: "user-123" });
  });

  it("serializes every criterion and reads pagination metadata", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        data: [],
        meta: {
          pagination: { page: 2, pageSize: 25, total: 30, totalPages: 2 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      listUsers({
        search: " alice ",
        role: "user",
        status: "active",
        emailVerified: false,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      users: [],
      pagination: { page: 2, pageSize: 25, total: 30, totalPages: 2 },
    });

    const firstCall = fetch.mock.calls[0];
    if (firstCall === undefined) {
      throw new Error("Fetch was not called");
    }
    const parameters = new URL(firstCall[0] as string).searchParams;
    expect({
      search: parameters.get("search"),
      role: parameters.get("role"),
      status: parameters.get("status"),
      emailVerified: parameters.get("emailVerified"),
      page: parameters.get("page"),
      pageSize: parameters.get("pageSize"),
    }).toEqual({
      search: "alice",
      role: "user",
      status: "active",
      emailVerified: "false",
      page: "2",
      pageSize: "25",
    });
  });
  it("sends restoration version, reason and fresh proof only in the request body", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: { id: "published-revision", version: 8 } }),
    });
    vi.stubGlobal("fetch", fetch);
    const input = {
      expectedVersion: 7,
      justification: "Restore the reviewed revision",
      confirmedCritical: true,
      password: "test-password-proof",
      mfaCode: "123456",
    };
    await rollbackSecurityConfig("revision-id", input);
    const call = fetch.mock.calls[0];
    if (!call) {
      throw new Error("Missing request");
    }
    expect(String(call[0])).toMatch(
      /\/iam\/admin\/security\/config\/revision-id\/rollback$/,
    );
    expect(String(call[0])).not.toContain(input.password);
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual(input);
    expect((call[1] as RequestInit).credentials).toBe("include");
  });
  it("keeps publication confirmation separate from its fresh authentication proof", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: { id: "published-revision", version: 8 } }),
    });
    vi.stubGlobal("fetch", fetch);
    await publishSecurityConfig({}, 3, "Reviewed change", true, {
      password: "test-password-proof",
      mfaCode: "123456",
    });
    const call = fetch.mock.calls[0];
    if (!call) {
      throw new Error("Missing request");
    }
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
      values: {},
      expectedVersion: 3,
      justification: "Reviewed change",
      confirmedCritical: true,
      password: "test-password-proof",
      mfaCode: "123456",
    });
  });
});
