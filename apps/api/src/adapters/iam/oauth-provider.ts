import type { IncomingMessage, ServerResponse } from "node:http";

import {
  DelegatedAuthorization,
  type SessionRepository,
} from "@architecture/iam/application";
import type { ProtectedResource } from "@architecture/iam/domain";
import type { KyselyDelegatedAuthorizationAdapter } from "@architecture/iam-persistence-kysely";
import debug from "debug";
import Provider, { errors, interactionPolicy } from "oidc-provider";

import type { OAuthOptions } from "#config/oauth.config";

import { createOAuthArtifacts, oauthScope } from "./oauth-artifacts.js";
import { OAuthSecrets } from "./oauth-secrets.js";
import { createOAuthTransactions } from "./oauth-transaction.js";

const day = 86_400;
export const oauthRequestBudget = 6_000;
const interactionLifetime = 600;
const familyLifetime = 90 * day;
const rollback = Symbol("OAuth response requires rollback");
const providerDebugExclusion = "-oidc-provider:*";

function redactProviderDiagnostics() {
  const pattern = debug.disable();
  const namespaces = pattern.split(",").filter(Boolean);
  if (!namespaces.includes(providerDebugExclusion)) {
    namespaces.push(providerDebugExclusion);
  }
  debug.enable(namespaces.join(","));
}

export function createOAuthProvider(
  options: OAuthOptions,
  store: KyselyDelegatedAuthorizationAdapter,
  sessions: SessionRepository,
  resources: readonly ProtectedResource[],
) {
  redactProviderDiagnostics();
  const authority = new DelegatedAuthorization(resources);
  const transactions = createOAuthTransactions(store, sessions);
  const secrets = new OAuthSecrets(options.artifactKeys, options.bindingKeys);
  const artifacts = createOAuthArtifacts(
    transactions,
    secrets,
    authority,
    resources,
  );
  const { base, Check } = interactionPolicy;
  const policy = base();
  policy
    .get("login")
    ?.checks.add(
      new Check(
        "first_party_session",
        "First-party session required",
        "login_required",
        ({ oidc }) => !oidc.result?.login && !oidc.result?.consent,
      ),
      0,
    );
  policy
    .get("consent")
    ?.checks.add(
      new Check(
        "first_party_consent",
        "Explicit consent required",
        "consent_required",
        ({ oidc }) => !oidc.result?.consent?.grantId,
      ),
      0,
    );
  const secure = new URL(options.issuer).protocol === "https:";
  const cookies = {
    signed: true,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  };
  const provider = new Provider(options.issuer, {
    adapter: artifacts.adapter,
    jwks: options.jwks,
    cookies: {
      keys: options.cookieKeys,
      names: {
        session: "oauth_session",
        interaction: "oauth_interaction",
        resume: "oauth_resume",
      },
      long: cookies,
      short: cookies,
    },
    responseTypes: ["code"],
    scopes: [],
    pkce: { required: () => true },
    ttl: {
      AccessToken: 600,
      AuthorizationCode: 300,
      Grant: familyLifetime,
      Interaction: interactionLifetime,
      Session: interactionLifetime,
      RefreshToken: (_context, token) =>
        Math.max(1, Math.min(30 * day, familyLifetime - token.totalLifetime())),
    },
    features: {
      devInteractions: { enabled: false },
      userinfo: { enabled: false },
      rpInitiatedLogout: { enabled: false },
      registration: { enabled: false },
      revocation: { enabled: false },
      introspection: { enabled: false },
      clientIdMetadataDocument: { enabled: false },
      resourceIndicators: {
        enabled: true,
        defaultResource: () => {
          throw new errors.InvalidTarget();
        },
        useGrantedResource: () => false,
        async getResourceServerInfo({ oidc }, identifier, client) {
          const resource = resources.find(({ uri }) => uri === identifier);
          const registered = await artifacts.client(client.clientId);
          const permissionPolicy = resource && registered?.policyFor(resource);
          if (
            !resource ||
            !permissionPolicy ||
            oidc.params?.["resource"] !== identifier
          ) {
            throw new errors.InvalidTarget();
          }
          const allowed = [
            ...permissionPolicy.required,
            ...permissionPolicy.optional,
          ];
          if (oidc.route === "authorization" || oidc.route === "resume") {
            const scope = oauthScope(oidc.params["scope"] as string);
            if (
              !scope.length ||
              !permissionPolicy.required.every((code) =>
                scope.includes(code),
              ) ||
              !scope.every((code) => allowed.includes(code))
            ) {
              throw new errors.InvalidScope("Invalid scope", "");
            }
          }
          const context = transactions.current();
          const familyExpiry = [...context.requestedFamilies.values()][0];
          const ttl = familyExpiry
            ? Math.floor((familyExpiry.getTime() - Date.now()) / 1000)
            : 600;
          if (ttl <= 0) {
            throw new errors.InvalidGrant();
          }
          return {
            scope: allowed.join(" "),
            audience: identifier,
            accessTokenFormat: "opaque",
            accessTokenTTL: Math.min(600, ttl),
          };
        },
      },
    },
    interactions: {
      policy,
      url: (_context, interaction) => `/oauth/consent/${interaction.uid}`,
    },
    expiresWithSession: () => false,
    issueRefreshToken: () => true,
    rotateRefreshToken: true,
    clientBasedCORS: () => false,
    renderError(context, error) {
      context.body = { error: error.error };
    },
    async findAccount(_context, accountId) {
      if (await transactions.current().reader.eligibleAccount(accountId)) {
        return { accountId, claims: async () => ({ sub: accountId }) };
      }
      return undefined;
    },
    async loadExistingGrant({ oidc }) {
      const grantId = oidc.result?.consent?.grantId;
      if (typeof grantId !== "string") {
        return undefined;
      }
      const actor = transactions.current().actor;
      const grant = await oidc.provider.Grant.find(grantId);
      if (!grant || !actor || grant.accountId !== actor.accountId) {
        throw new errors.AccessDenied();
      }
      return grant;
    },
  });
  provider.proxy = options.trustProxy;

  const ingress = new WeakMap<
    IncomingMessage,
    { deadline: number; sid: string | undefined }
  >();
  provider.silent = true;
  provider.on("server_error", () => {
    transactions.current().serverError = true;
  });
  provider.on("authorization.error", () => {
    transactions.current().protocolError = true;
  });
  provider.use(async (context, next) => {
    const request = ingress.get(context.req);
    try {
      if (!request) {
        throw new Error("Missing OAuth ingress context");
      }
      await transactions.run("exclusive", request.deadline, async (tx) => {
        tx.actor = await tx.session(request.sid);
        if (tx.actor) {
          await tx.lock(tx.actor.accountId);
        }
        if (context.path.startsWith("/auth/")) {
          const id = context.path.slice("/auth/".length);
          const saved = await provider.Interaction.find(id);
          const pending = saved?.cid && (await artifacts.pending(saved.cid));
          if (
            !saved ||
            !pending ||
            !tx.actor ||
            pending.account_id !== tx.actor.accountId ||
            !secrets.matches(pending.binding, tx.actor.sessionId) ||
            (pending.decided &&
              !saved.result?.consent &&
              !saved.result?.["error"])
          ) {
            throw new errors.AccessDenied();
          }
          const client = await tx.reader.client(pending.client_id);
          if (
            !client?.state.enabled ||
            client.state.revision !== pending.client_revision
          ) {
            throw new errors.AccessDenied();
          }
        }
        await next();
        if (tx.serverError) {
          throw new Error("OAuth provider failed");
        }
        if (
          context.status >= 400 &&
          context.body &&
          typeof context.body === "object" &&
          "error" in context.body
        ) {
          context.body = { error: context.body.error };
        }
        if (
          context.res.destroyed ||
          ((context.status >= 400 || tx.protocolError) && !tx.replay)
        ) {
          throw rollback;
        }
      });
    } catch (error) {
      if (error === rollback && !context.res.destroyed) {
        context.remove("Set-Cookie");
        return;
      }
      context.remove("Location");
      context.remove("Set-Cookie");
      context.set("Cache-Control", "no-store");
      context.status = error instanceof errors.AccessDenied ? 403 : 503;
      context.body = {
        error: context.status === 403 ? "access_denied" : "server_error",
      };
    }
  });

  const callback = provider.callback();
  return {
    issuer: options.issuer,
    provider,
    transactions,
    artifacts,
    authority,
    async purgeExpired() {
      await transactions.run(
        "exclusive",
        performance.now() + oauthRequestBudget,
        async ({ db }) => {
          const cutoff = new Date();
          // A small transaction shares the erasure and revocation lock order. Families own their remaining artifacts.
          await db
            .deleteFrom("iam_oauth_families")
            .where("id", "in", (query) =>
              query
                .selectFrom("iam_oauth_families")
                .select("id")
                .where("expires_at", "<=", cutoff)
                .orderBy("expires_at")
                .limit(50),
            )
            .execute();
          await db
            .deleteFrom("iam_oauth_artifacts")
            .where("id", "in", (query) =>
              query
                .selectFrom("iam_oauth_artifacts")
                .select("id")
                .where("expires_at", "<=", cutoff)
                .orderBy("expires_at")
                .limit(500),
            )
            .execute();
          await db
            .deleteFrom("iam_oauth_pending")
            .where("id", "in", (query) =>
              query
                .selectFrom("iam_oauth_pending")
                .select("id")
                .where("expires_at", "<=", cutoff)
                .orderBy("expires_at")
                .limit(500),
            )
            .execute();
        },
      );
    },
    async protocol(
      req: IncomingMessage,
      res: ServerResponse,
      deadline: number,
      sid?: string,
    ) {
      ingress.set(req, { deadline, sid });
      try {
        await callback(req, res);
      } finally {
        ingress.delete(req);
      }
    },
    async admit(input: {
      token: string;
      resourceId: string;
      permission: string;
    }) {
      return transactions.run(
        "shared",
        performance.now() + oauthRequestBudget,
        async (tx) => {
          const token = await new artifacts.adapter("AccessToken").find(
            input.token,
          );
          if (!token?.grantId) {
            return;
          }
          const lineage = await artifacts.family(token.grantId);
          if (
            !lineage ||
            token.aud !== lineage.resource.uri ||
            token.accountId !== lineage.account_id
          ) {
            return;
          }
          const result = await authority.admit(tx.reader, {
            credential: lineage.authority,
            intendedResourceId: input.resourceId,
            permission: input.permission,
            scope: oauthScope(token.scope),
          });
          return result.success ? result.value : undefined;
        },
      );
    },
  };
}

export type OAuthProvider = ReturnType<typeof createOAuthProvider>;
