import { afterEach, describe, expect, it, vi } from "vitest";

import { listUsers } from "./api.js";

describe("IAM administration API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
