import { createServer } from "node:http";
import { once } from "node:events";
import { takeCoverage } from "node:v8";
import { fastifyHost } from "./fastify-host.mjs";
import Provider, { errors, interactionPolicy } from "oidc-provider";
import { postgresAdapter } from "./adapter.mjs";
import {
  createIam,
  openDatabase,
  permissions,
  redirect,
  resource,
} from "./database.mjs";

const { schema, url, mode, key, cookieKeys, jwk, requireRedirect } = JSON.parse(
  process.env.SPIKE_FIXTURE,
);
const db = openDatabase(schema);
const fastify = process.env.SPIKE_HOST === "fastify";
const day = 86400;
let browserOrigin;
const iam = createIam(db, mode);
const { one, query, state, transaction } = db;
const { Check, base } = interactionPolicy;
const policy = base();
policy
  .get("login")
  .checks.add(
    new Check(
      "first_party_login",
      "first-party session required",
      "login_required",
      ({ oidc }) => !oidc.result?.login,
    ),
    0,
  );
policy
  .get("consent")
  .checks.add(
    new Check(
      "iam_consent",
      "explicit IAM consent required",
      "consent_required",
      ({ oidc }) => !oidc.result?.consent?.grantId,
    ),
    0,
  );

let fault;
let unblock;
process.on("message", (message) => {
  if (message === "shutdown") {
    void shutdown();
  } else if (message === "release") {
    unblock?.();
  } else {
    fault = message;
    process.send("armed");
  }
});

async function pause() {
  await new Promise((resolve) => {
    const watchdog = setTimeout(resolve, 4000);
    unblock = () => {
      clearTimeout(watchdog);
      resolve();
    };
    process.send("paused");
  });
  unblock = undefined;
}

async function beforeSave(model) {
  if (
    (model === "AuthorizationCode" && fault === "code-commit-error") ||
    (model === "Grant" && fault === "consent-commit-error")
  ) {
    fault = undefined;
    await query(
      "INSERT INTO commit_probe VALUES ('missing-synthetic-account')",
    );
  }
  if (model !== "AccessToken" || !fault) return;
  if (fault === "pause-after-commit") return;
  const action = fault;
  fault = undefined;
  if (action === "sql-error") {
    await query("SELECT deliberately_missing_spike_function()");
  } else if (action === "commit-error") {
    await query(
      "INSERT INTO commit_probe VALUES ('missing-synthetic-account')",
    );
  } else if (action === "pause") {
    await pause();
  }
}

const adapter = postgresAdapter(db, iam, key, beforeSave, requireRedirect);
const provider = new Provider(url, {
  adapter,
  jwks: { keys: [jwk] },
  cookies: {
    keys: cookieKeys,
    long: { signed: true },
    short: { signed: true },
  },
  clients: ["synthetic-app", "other-app"].map((id) => ({
    client_id: id,
    redirect_uris: [redirect],
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    id_token_signed_response_alg: "ES256",
    token_endpoint_auth_method: "none",
  })),
  responseTypes: ["code"],
  pkce: { required: () => true },
  ttl: {
    AccessToken: 600,
    AuthorizationCode: 300,
    RefreshToken: (_ctx, token) =>
      Math.max(1, Math.min(30 * day, 90 * day - token.totalLifetime())),
    Grant: 90 * day,
    Interaction: 600,
  },
  features: {
    devInteractions: { enabled: false },
    userinfo: { enabled: false },
    rpInitiatedLogout: { enabled: false },
    registration: { enabled: false },
    revocation: { enabled: false },
    introspection: { enabled: false },
    resourceIndicators: {
      enabled: true,
      defaultResource: ({ oidc }) => {
        if (["authorization", "resume"].includes(oidc.route)) {
          if (
            fastify &&
            oidc.params.response_mode &&
            oidc.params.response_mode !== "query"
          ) {
            throw new errors.InvalidRequest(
              "the spike only accepts query response mode",
            );
          }
          throw new errors.InvalidTarget("an explicit resource is required");
        }
      },
      useGrantedResource: () => true,
      async getResourceServerInfo({ oidc }, identifier, client) {
        if (fastify && oidc.params.resource !== resource) {
          throw new errors.InvalidTarget(
            "an explicit approved resource is required",
          );
        }
        const admitted = await iam.client(client.clientId);
        if (!admitted) throw new errors.InvalidClient("client unavailable");
        if (identifier !== resource || Array.isArray(oidc.params.resource)) {
          throw new errors.InvalidTarget(
            "expected exactly one approved resource",
          );
        }
        if (["authorization", "resume"].includes(oidc.route)) {
          const requested = permissions(oidc.params.scope);
          if (
            !requested.includes("read") ||
            !requested.every((name) => admitted.allowed.includes(name))
          ) {
            throw new errors.InvalidScope(
              "request exceeds IAM permission policy",
            );
          }
        }
        return {
          scope: admitted.allowed.join(" "),
          audience: resource,
          accessTokenFormat: "opaque",
        };
      },
    },
  },
  interactions: {
    policy,
    url: (_context, interaction) => "/consent/" + interaction.uid,
  },
  expiresWithSession: () => false,
  issueRefreshToken: (_context, client) =>
    client.grantTypeAllowed("refresh_token"),
  rotateRefreshToken: true,
  renderError(ctx, error) {
    ctx.body = error;
  },
  async findAccount(_context, accountId) {
    if (await iam.eligible(accountId)) {
      return { accountId, claims: async () => ({ sub: accountId }) };
    }
  },
  async loadExistingGrant({ oidc }) {
    const id = oidc.result?.consent?.grantId;
    if (!id) return undefined;
    const grant = await provider.Grant.find(id);
    if (!grant || state().actor?.account_id !== grant.accountId) {
      throw new errors.AccessDenied(undefined, "consent is no longer valid");
    }
    return grant;
  },
  clientBasedCORS: () => false,
});

function cookie(req, name) {
  return (req.headers.cookie ?? "")
    .split("; ")
    .find((item) => item.startsWith(name + "="))
    ?.slice(name.length + 1);
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function interaction(req, res, path) {
  let body;
  if (req.method === "POST") {
    if (req.headers.origin !== browserOrigin) {
      return json(res, 403, { error: "origin" });
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 2048) return json(res, 413, { error: "request_too_large" });
      chunks.push(chunk);
    }
    body = JSON.parse(Buffer.concat(chunks).toString());
  }
  const result = await transaction(async (tx) => {
    tx.actor = await iam.session(cookie(req, "first_party"));
    let details;
    try {
      details = await provider.interactionDetails(req, res);
    } catch (error) {
      if (error instanceof errors.SessionNotFound)
        return { status: 400, error: "interaction" };
      throw error;
    }
    if (path !== "/consent/" + details.uid || !tx.actor) {
      return { status: 403, error: "first_party_session" };
    }
    const { params, prompt } = details;
    const { account_id: accountId, id: sessionId } = tx.actor;
    const clientId = params.client_id;
    const admitted = await iam.client(clientId);
    const requested = permissions(params.scope);
    if (
      !admitted ||
      params.resource !== resource ||
      !requested.includes("read") ||
      !requested.every((name) => admitted.allowed.includes(name))
    ) {
      return { status: 403, error: "request_policy" };
    }

    if (prompt.name === "login") {
      if (req.method !== "POST")
        return { status: 200, name: "login", accountId };
      if (body?.confirm !== true)
        return { status: 400, error: "login_interaction" };
      await iam.captureConsent(details.cid, tx.actor, clientId);
      const origin = await one(
        "SELECT account_id, session_id FROM pending WHERE id = $1",
        [details.cid],
      );
      if (origin.account_id !== accountId || origin.session_id !== sessionId) {
        return { status: 403, error: "session_binding" };
      }
      return {
        location: await provider.interactionResult(req, res, {
          login: { accountId },
        }),
      };
    }

    if (details.session?.accountId !== accountId)
      return { status: 403, error: "account_binding" };
    const revision = await iam.epoch(accountId, clientId);
    if (req.method === "GET") {
      return {
        status: 200,
        name: "consent",
        accountId,
        clientId,
        resource,
        required: ["read"],
        optional: requested.filter((name) => name !== "read"),
      };
    }

    const pending = await one(
      `DELETE FROM pending WHERE id = $1 AND account_id = $2 AND client_id = $3
       AND session_id = $4 AND expires_at > now() RETURNING revision`,
      [details.cid, accountId, clientId, sessionId],
    );
    const selected = body?.selected;
    if (
      Array.isArray(selected) &&
      !selected.every((name) => requested.includes(name))
    ) {
      return { status: 400, error: "unexpected_permission" };
    }
    if (
      pending?.revision !== revision ||
      !Array.isArray(selected) ||
      !selected.includes("read")
    ) {
      return {
        location: await provider.interactionResult(req, res, {
          error: "access_denied",
        }),
      };
    }

    const approval = await iam.approve(accountId, clientId, selected);
    const grant = new provider.Grant({ accountId, clientId });
    grant.addResourceScope(resource, selected);
    const declined = requested.filter((name) => !selected.includes(name));
    if (declined.length) grant.rejectResourceScope(resource, declined);
    const grantId = await grant.save();
    await query(
      "INSERT INTO family (id, grant_id, entitlements) VALUES ($1, $2, $3)",
      [grantId, approval.grantId, approval.entitlements],
    );
    return {
      location: await provider.interactionResult(req, res, {
        consent: { grantId },
      }),
    };
  });
  if (result.location) {
    res.writeHead(303, {
      Location: result.location,
      "Cache-Control": "no-store",
    });
    res.end();
  } else {
    const { status, ...payload } = result;
    json(res, status, payload);
  }
}

async function admit(req, res, requestUrl) {
  const decision = await transaction(async () => {
    if (fault === "admission-error") {
      fault = undefined;
      await query("SELECT deliberately_missing_spike_function()");
    }
    const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!bearer) return false;
    const token = await new adapter("AccessToken").find(bearer);
    if (!token || token.aud !== requestUrl.searchParams.get("resource"))
      return false;
    const lineage = await iam.family(token.grantId);
    const permission = requestUrl.searchParams.get("permission");
    return Boolean(
      lineage &&
      lineage.resource === token.aud &&
      lineage.client_id === token.clientId &&
      lineage.account_id === token.accountId &&
      token.accountId === requestUrl.searchParams.get("account") &&
      lineage.scope.includes(permission) &&
      permissions(token.scope).includes(permission),
    );
  });
  json(res, decision ? 200 : 403, { admitted: decision });
}

provider.on("server_error", () => {
  state().rollback = true;
});
provider.use(async (ctx, next) => {
  if (fastify && ctx.path === "/token") {
    ctx.res.once("close", () => {
      if (!ctx.res.writableFinished) process.send("disconnect");
    });
  }
  try {
    await transaction(async (tx) => {
      tx.actor = await iam.session(cookie(ctx.req, "first_party"));
      await next();
      if ((ctx.res.destroyed || ctx.status >= 400) && !tx.replay)
        tx.rollback = true;
    });
    if (ctx.path === "/token" && fault === "pause-after-commit") {
      fault = undefined;
      await pause();
    }
  } catch {
    ctx.remove("Location");
    ctx.remove("Set-Cookie");
    ctx.status = 503;
    ctx.body = { error: "server_error" };
  }
});

const protocol = provider.callback();
async function handle(req, res) {
  const requestUrl = new URL(req.url, url);
  const { pathname } = requestUrl;
  try {
    if (pathname.startsWith("/consent/")) {
      await interaction(req, res, pathname);
    } else if (pathname === "/admit") {
      await admit(req, res, requestUrl);
    } else if (pathname === "/session/end/confirm") {
      json(res, 404, { error: "disabled" });
    } else {
      await protocol(req, res);
    }
  } catch {
    if (!res.destroyed && !res.headersSent) {
      res.removeHeader("Location");
      res.removeHeader("Set-Cookie");
      json(res, 503, { error: "server_error" });
    }
  }
}

const app = fastify ? fastifyHost(handle, url) : undefined;
const server = app?.server ?? createServer(handle);
if (app) {
  await app.listen({ port: 0, host: "127.0.0.1" });
} else {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}
const { port } = server.address();
const boundOrigin = new URL(url);
boundOrigin.port = String(port);
browserOrigin = boundOrigin.origin;
process.send({ port });

async function shutdown() {
  server.closeAllConnections();
  if (app) await app.close();
  else {
    server.close();
    await once(server, "close");
  }
  await db.pool.end();
  if (process.env.NODE_V8_COVERAGE) takeCoverage();
  process.disconnect();
}
