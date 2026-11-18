const repositoryId = 1336937640;
const repository = "Oxelio/architecture-web";

export async function verifyControllerInstallation(input: {
  readonly token: string;
  readonly appSlug: string;
  readonly expectedAppSlug: string;
  readonly installationId: number;
  readonly expectedInstallationId: number;
  readonly expectedAppId?: number;
  readonly fetchImpl?: typeof fetch;
}): Promise<{
  repositoryId: number;
  installationId: number;
  botId: number;
} | null> {
  if (
    !input.token.trim() ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(input.appSlug) ||
    input.appSlug !== input.expectedAppSlug ||
    !Number.isSafeInteger(input.installationId) ||
    input.installationId <= 0 ||
    input.installationId !== input.expectedInstallationId
  ) {
    return null;
  }

  const get = (path: string) =>
    (input.fetchImpl ?? fetch)(`https://api.github.com${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.token}`,
        "x-github-api-version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

  try {
    const login = `${input.appSlug}[bot]`;
    const [repositoryResponse, botResponse, appResponse] = await Promise.all([
      get("/installation/repositories?per_page=2"),
      get(`/users/${encodeURIComponent(login)}`),
      input.expectedAppId === undefined ? null : get(`/apps/${input.appSlug}`),
    ]);
    if (!repositoryResponse.ok || !botResponse.ok) {
      return null;
    }

    const accessible = (await repositoryResponse.json()) as {
      readonly total_count?: number;
      readonly repositories?: readonly {
        readonly id: number;
        readonly full_name: string;
      }[];
    };
    const bot = (await botResponse.json()) as {
      readonly id: number;
      readonly login?: string;
      readonly type?: string;
    };
    const app = appResponse?.ok
      ? ((await appResponse.json()) as { readonly id?: number })
      : null;
    if (
      accessible.total_count !== 1 ||
      !Array.isArray(accessible.repositories) ||
      accessible.repositories.length !== 1 ||
      accessible.repositories[0]?.id !== repositoryId ||
      accessible.repositories[0]?.full_name !== repository ||
      bot.login !== login ||
      bot.type !== "Bot" ||
      (input.expectedAppId !== undefined && app?.id !== input.expectedAppId) ||
      !Number.isSafeInteger(bot.id) ||
      bot.id <= 0
    ) {
      return null;
    }

    return {
      repositoryId,
      installationId: input.installationId,
      botId: bot.id,
    };
  } catch {
    return null;
  }
}
