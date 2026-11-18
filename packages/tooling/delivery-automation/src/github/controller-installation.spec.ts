import { describe, expect, it, vi } from "vitest";

import { verifyControllerInstallation } from "./controller-installation.js";

const appSlug = "architecture-web-work-controller";
const installationId = 1234;
const repository = { id: 1336937640, full_name: "Oxelio/architecture-web" };
const bot = { id: 42, login: `${appSlug}[bot]`, type: "Bot" };
const accessible = { total_count: 1, repositories: [repository] };
const binding = {
  token: "fixture",
  appSlug,
  expectedAppSlug: appSlug,
  installationId,
  expectedInstallationId: installationId,
};

function responses(
  repositoryResponse: Response,
  botResponse: Response = Response.json(bot),
) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(repositoryResponse)
    .mockResolvedValueOnce(botResponse);
}

describe("Work integration controller installation", () => {
  it.each([42, 44])(
    "requires the pinned App ID when provided (%s)",
    async (id) => {
      const fetchImpl = responses(
        Response.json(accessible),
      ).mockResolvedValueOnce(Response.json({ id }));
      const result = await verifyControllerInstallation({
        ...binding,
        expectedAppId: 42,
        fetchImpl,
      });
      expect(Boolean(result)).toBe(id === 42);
      expect(fetchImpl.mock.calls[2]?.[0]).toBe(
        "https://api.github.com/apps/architecture-web-work-controller",
      );
    },
  );

  it("binds the installation to one repository and the registered App bot", async () => {
    const fetchImpl = responses(Response.json(accessible));
    await expect(
      verifyControllerInstallation({ ...binding, fetchImpl }),
    ).resolves.toEqual({
      repositoryId: repository.id,
      installationId,
      botId: bot.id,
    });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.github.com/installation/repositories?per_page=2",
      "https://api.github.com/users/architecture-web-work-controller%5Bbot%5D",
    ]);
    expect(
      fetchImpl.mock.calls.every(
        ([, options]) => options?.redirect === "error",
      ),
    ).toBe(true);
  });

  it.each([
    { appSlug: "other-app" },
    { appSlug: "../other", expectedAppSlug: "../other" },
    { installationId: 9876 },
    { token: "" },
  ])(
    "rejects unbound action output without a GitHub request",
    async (invalid) => {
      const fetchImpl = vi.fn<typeof fetch>();
      await expect(
        verifyControllerInstallation({ ...binding, ...invalid, fetchImpl }),
      ).resolves.toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...accessible, total_count: 2 },
    {
      ...accessible,
      repositories: [repository, { id: 99, full_name: "Oxelio/other" }],
    },
    { ...accessible, repositories: [{ ...repository, id: 0 }] },
    {
      ...accessible,
      repositories: [{ ...repository, full_name: "Oxelio/other" }],
    },
    { ...accessible, repositories: [] },
  ])(
    "rejects a broadened, incomplete or mismatched repository scope",
    async (inventory) => {
      await expect(
        verifyControllerInstallation({
          ...binding,
          fetchImpl: responses(Response.json(inventory)),
        }),
      ).resolves.toBeNull();
    },
  );

  it.each([
    { ...bot, type: "User" },
    { ...bot, login: "other[bot]" },
    { ...bot, id: 0 },
  ])("rejects a mismatched bot", async (identity) => {
    await expect(
      verifyControllerInstallation({
        ...binding,
        fetchImpl: responses(
          Response.json(accessible),
          Response.json(identity),
        ),
      }),
    ).resolves.toBeNull();
  });

  it("fails closed when the installation cannot be queried", async () => {
    await expect(
      verifyControllerInstallation({
        ...binding,
        fetchImpl: responses(new Response(null, { status: 403 })),
      }),
    ).resolves.toBeNull();
    await expect(
      verifyControllerInstallation({
        ...binding,
        fetchImpl: vi
          .fn<typeof fetch>()
          .mockRejectedValue(new Error("timeout")),
      }),
    ).resolves.toBeNull();
  });
});
