import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { PreparedConsent } from "@architecture/iam/application";
import type { FastifyPluginAsync } from "fastify";
import { errors } from "oidc-provider";
import { z } from "zod";

import { SESSION_COOKIE_NAME } from "#app/auth";

import { type OAuthProvider, oauthRequestBudget } from "./oauth-provider.js";
import type { OAuthTransaction } from "./oauth-transaction.js";

declare module "fastify" {
  interface FastifyContextConfig {
    cors?: boolean;
  }
}

const identifier = /^[A-Za-z0-9_-]{16,128}$/u;
const codeChallenge = /^[A-Za-z0-9_-]{43}$/u;
const protocolRoutes = new Set(["/token", "/auth", "/auth/:uid"]);
const authParameters = new Set([
  "client_id",
  "redirect_uri",
  "response_type",
  "response_mode",
  "code_challenge",
  "code_challenge_method",
  "resource",
  "scope",
  "state",
]);
const decision = z.union([
  z.strictObject({ confirm: z.literal(true) }),
  z.strictObject({ deny: z.literal(true) }),
  z.strictObject({ selected: z.array(z.string()).max(100) }),
]);

function validAuthorization(query: URLSearchParams) {
  return (
    [...query.keys()].every(
      (name) => authParameters.has(name) && query.getAll(name).length === 1,
    ) &&
    query.get("response_type") === "code" &&
    (!query.has("response_mode") || query.get("response_mode") === "query") &&
    query.get("code_challenge_method") === "S256" &&
    codeChallenge.test(query.get("code_challenge") ?? "") &&
    ["client_id", "redirect_uri", "scope", "resource"].every((name) =>
      Boolean(query.get(name)),
    )
  );
}

function validProtocolTarget(target: URL, issuer: string) {
  if (target.origin !== issuer) {
    return false;
  }
  if (target.pathname === "/auth") {
    return validAuthorization(target.searchParams);
  }
  return (
    !target.pathname.startsWith("/auth/") ||
    (identifier.test(target.pathname.slice(6)) && !target.search)
  );
}

function boundTokenBody(raw: IncomingMessage) {
  if (Number(raw.headers["content-length"]) > 56 * 1024) {
    return false;
  }
  const timer = setTimeout(() => raw.destroy(), 1000);
  raw.once("end", () => clearTimeout(timer));
  raw.once("close", () => clearTimeout(timer));
  return true;
}

function signInContinuation(
  uid: string,
  boundAccountId: string | null,
  post: boolean,
) {
  if (boundAccountId || post) {
    throw new errors.AccessDenied();
  }
  const interactionPath = `/oauth/consent/${uid}`;
  return {
    location: `/signin?continue=${encodeURIComponent(interactionPath)}`,
  };
}

async function resolvePendingInteraction(
  oauth: OAuthProvider,
  request: IncomingMessage,
  response: ServerResponse,
  uid: string,
) {
  const details = await oauth.provider.interactionDetails(request, response);
  if (response.destroyed) {
    throw new Error("OAuth request disconnected");
  }
  if (uid !== details.uid || details.result) {
    throw new errors.AccessDenied();
  }
  const existing = await oauth.artifacts.pending(details.cid);
  if (!existing || existing.decided) {
    throw new errors.AccessDenied();
  }
  return { details, boundAccountId: existing.account_id };
}

async function finishConsent(
  oauth: OAuthProvider,
  tx: OAuthTransaction,
  input: {
    pendingId: string;
    expiresAt: Date;
    consent: PreparedConsent;
    selected: readonly string[] | undefined;
    sid: string | undefined;
    actorId: string;
    publicClientId: unknown;
  },
): Promise<Parameters<OAuthProvider["provider"]["interactionResult"]>[2]> {
  const spent = await tx.db
    .updateTable("iam_oauth_pending")
    .set({ decided: true })
    .where("id", "=", input.pendingId)
    .where("decided", "=", false)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();
  if (spent.numUpdatedRows !== 1n) {
    throw new errors.AccessDenied();
  }
  if (!input.selected) {
    return { error: "access_denied" };
  }
  const approval = await oauth.authority.finalize(
    await tx.lock(input.actorId),
    {
      consent: input.consent,
      selected: [...new Set(input.selected)],
      expiresAt: input.expiresAt,
      sessionIsCurrent: async (accountId) =>
        (await tx.session(input.sid))?.accountId === accountId,
    },
  );
  if (!approval.success) {
    return { error: "access_denied" };
  }
  const lineage = approval.value;
  const grantId = randomUUID();
  await tx.db
    .insertInto("iam_oauth_families")
    .values({
      id: grantId,
      account_id: lineage.accountId,
      client_id: lineage.clientId,
      grant_id: lineage.grantId,
      authority: JSON.stringify(lineage),
      expires_at: new Date(Date.now() + 90 * 86_400_000),
    })
    .execute();
  const grant = new oauth.provider.Grant({
    accountId: input.actorId,
    clientId: String(input.publicClientId),
  });
  grant.jti = grantId;
  const { resourceUri } = input.consent;
  const codes = lineage.entitlements.map(({ code }) => code);
  grant.addResourceScope(resourceUri, codes);
  const declined = input.consent.requested.filter(
    (code) => !codes.includes(code),
  );
  if (declined.length) {
    grant.rejectResourceScope(resourceUri, declined);
  }
  await grant.save();
  return { consent: { grantId } };
}

export function buildOAuthRoutes(oauth: OAuthProvider): FastifyPluginAsync {
  return async (app) => {
    const issuer = new URL(oauth.issuer);
    app.addHook("onRequest", async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
      if (`${request.protocol}:` !== issuer.protocol) {
        return reply.status(400).send({ error: "invalid_request" });
      }
      if (protocolRoutes.has(request.routeOptions.url ?? "")) {
        const path = new URL(request.url, oauth.issuer);
        if (!validProtocolTarget(path, oauth.issuer)) {
          return reply.status(400).send({ error: "invalid_request" });
        }
        const raw = request.raw;
        // Provider-generated resume URLs use Koa's request host.
        raw.headers.host = issuer.host;
        delete raw.headers["x-forwarded-host"];
        if (request.method === "POST" && !boundTokenBody(raw)) {
          return reply.status(413).send({ error: "invalid_request" });
        }
        const sid =
          path.pathname === "/token"
            ? undefined
            : request.cookies[SESSION_COOKIE_NAME];
        if (path.pathname === "/auth" && raw.headers.cookie) {
          const providerSession = oauth.provider.cookieName("session");
          raw.headers.cookie = raw.headers.cookie
            .split(";")
            .filter(
              (cookie) =>
                ![providerSession, `${providerSession}.sig`].includes(
                  cookie.trim().split("=")[0] ?? "",
                ),
            )
            .join(";");
        }
        reply.hijack();
        // CORS is deliberately unavailable on the issuer endpoints.
        reply.raw.setHeader("Cache-Control", "no-store");
        reply.raw.setHeader("Referrer-Policy", "no-referrer");
        await oauth.protocol(
          raw,
          reply.raw,
          performance.now() + oauthRequestBudget,
          sid,
        );
        if (reply.raw.statusCode >= 500) {
          request.log.warn(
            { requestId: String(request.id) },
            "Delegated OAuth request failed",
          );
        }
      }
    });

    const options = {
      config: { cors: false },
      exposeHeadRoute: false,
    } as const;
    app.get("/.well-known/oauth-authorization-server", options, () => ({
      issuer: oauth.issuer,
      authorization_endpoint: oauth.issuer + "/auth",
      token_endpoint: oauth.issuer + "/token",
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
    }));
    const unavailable = () => {
      throw new Error("The OAuth transport must own this response");
    };
    app.get("/auth", options, unavailable);
    app.get("/auth/:uid", options, unavailable);
    app.post("/token", { config: options.config }, unavailable);

    app.route<{ Params: { uid: string } }>({
      url: "/oauth/consent/:uid",
      method: ["GET", "POST"],
      exposeHeadRoute: false,
      bodyLimit: 2048,
      config: options.config,
      async handler(request, reply) {
        const { uid } = request.params;
        if (!identifier.test(uid)) {
          return reply.status(400).send({ error: "invalid_request" });
        }
        const post = request.method === "POST";
        const input = decision.safeParse(request.body);
        if (
          post &&
          (request.headers.origin !== oauth.issuer ||
            !request.headers["content-type"]?.startsWith("application/json"))
        ) {
          return reply.status(403).send({ error: "access_denied" });
        }
        if (post && !input.success) {
          return reply.status(400).send({ error: "invalid_request" });
        }
        try {
          const response = await oauth.transactions.run(
            "exclusive",
            performance.now() + oauthRequestBudget,
            async (tx) => {
              const sid = request.cookies[SESSION_COOKIE_NAME];
              const actor = await tx.session(sid);
              tx.actor = actor;
              if (actor) {
                await tx.lock(actor.accountId);
              }
              const { details, boundAccountId } =
                await resolvePendingInteraction(
                  oauth,
                  request.raw,
                  reply.raw,
                  uid,
                );
              if (!actor) {
                return signInContinuation(uid, boundAccountId, post);
              }
              const pending = await oauth.artifacts.capture(
                details,
                new Date(details.exp * 1000),
              );
              if (!pending.consent) {
                throw new errors.AccessDenied();
              }
              async function continueProtocol(
                result: Parameters<typeof oauth.provider.interactionResult>[2],
              ) {
                const location = await oauth.provider.interactionResult(
                  request.raw,
                  reply.raw,
                  result,
                );
                if (reply.raw.destroyed) {
                  throw new Error("OAuth request disconnected");
                }
                return { location };
              }
              if (details.prompt.name === "login") {
                if (!post) {
                  return { payload: { phase: "login" } };
                }
                if (!input.success || !("confirm" in input.data)) {
                  throw new errors.AccessDenied();
                }
                return continueProtocol({
                  login: { accountId: actor.accountId },
                });
              }
              if (
                details.prompt.name !== "consent" ||
                details.session?.accountId !== actor.accountId
              ) {
                throw new errors.AccessDenied();
              }
              const { applicationName, resourceUri, required, optional } =
                pending.consent;
              if (!post) {
                return {
                  payload: {
                    phase: "consent",
                    applicationName,
                    resourceUri,
                    required,
                    optional,
                  },
                };
              }
              if (!input.success || "confirm" in input.data) {
                throw new errors.AccessDenied();
              }
              const result = await finishConsent(oauth, tx, {
                pendingId: pending.id,
                expiresAt: pending.expires_at,
                consent: pending.consent,
                selected:
                  "selected" in input.data ? input.data.selected : undefined,
                sid,
                actorId: actor.accountId,
                publicClientId: details.params["client_id"],
              });
              return continueProtocol(result);
            },
          );
          return "location" in response
            ? reply.redirect(response.location, 303)
            : reply.send(response.payload);
        } catch (error) {
          reply.raw.removeHeader("Set-Cookie");
          if (
            error instanceof errors.SessionNotFound ||
            error instanceof errors.AccessDenied
          ) {
            return reply.status(403).send({ error: "access_denied" });
          }
          request.log.warn(
            { requestId: String(request.id) },
            "Delegated consent request failed",
          );
          return reply.status(503).send({ error: "server_error" });
        }
      },
    });
  };
}
