import assert from "node:assert/strict";
import { fork } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { postgresAdapter } from "./adapter.mjs";
import {
  createIam,
  openDatabase,
  redirect,
  resource,
  schemaSql,
} from "./database.mjs";

const account = "synthetic-alice";
const otherAccount = "synthetic-bob";
const client = "synthetic-app";
const otherClient = "other-app";
const issuer = "http://127.0.0.1:1";
const sessionA = "synthetic-web-session-a";
const sessionB = "synthetic-web-session-b";
const workerFile = fileURLToPath(new URL("./issuer.mjs", import.meta.url));

async function fixture(t, mode = "generations", requireRedirect = true) {
  const schema = "spike215_" + randomUUID().replaceAll("-", "");
  const db = openDatabase(schema);
  const iam = createIam(db, mode);
  const key = randomBytes(32).toString("hex");
  const jwk = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  }).privateKey.export({ format: "jwk" });
  const workers = [];
  t.after(async () => {
    await Promise.all(workers.map(({ stop }) => stop()));
    try {
      await db.pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await db.pool.end();
    }
  });
  await db.pool.query(`CREATE SCHEMA ${schema}`);
  await db.pool.query(schemaSql);
  await db.pool.query("INSERT INTO account(id) VALUES ($1), ($2)", [
    account,
    otherAccount,
  ]);
  await db.pool.query("INSERT INTO client(id) VALUES ($1), ($2)", [
    client,
    otherClient,
  ]);
  await db.pool.query(
    "INSERT INTO web_session(id, account_id) VALUES ($1, $2), ($3, $4)",
    [sessionA, account, sessionB, otherAccount],
  );

  async function start() {
    const child = fork(workerFile, {
      env: {
        ...process.env,
        DEBUG: "",
        SPIKE_FIXTURE: JSON.stringify({
          schema,
          url: issuer,
          mode,
          key,
          jwk,
          requireRedirect,
        }),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let logs = "";
    child.stdout.on("data", (data) => {
      logs += data.toString();
    });
    child.stderr.on("data", (data) => {
      logs += data.toString();
    });
    const worker = {
      logs: () => logs,
      async stop() {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const exited = once(child, "exit");
        child.kill();
        await exited;
      },
      async arm(fault) {
        const armed = waitMessage(child);
        child.send(fault);
        assert.equal(await armed, "armed");
      },
      paused: () => waitMessage(child),
      release: () => child.send("release"),
    };
    workers.push(worker);
    const { port } = await waitMessage(child);
    worker.base = "http://127.0.0.1:" + port;
    return worker;
  }

  const primary = await start();
  const sql = (sql, parameters) => db.pool.query(sql, parameters);
  const mutate = (change) => db.transaction(() => change(iam));
  return { db, key, iam, start, primary, sql, mutate };
}

function waitMessage(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error("Worker IPC timed out")),
      6000,
    );
    const message = (value) => finish(null, value);
    const exit = () => finish(new Error("Issuer worker exited unexpectedly"));
    const finish = (error, value) => {
      clearTimeout(timer);
      child.off("message", message).off("exit", exit);
      if (error) reject(error);
      else resolve(value);
    };
    child.once("message", message).once("exit", exit);
  });
}

async function http(worker, path, options) {
  return fetch(worker.base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
    ...options,
  });
}

async function json(response, status) {
  const body = await response.json();
  if (status !== undefined) {
    assert.equal(
      response.status,
      status,
      "Expected HTTP result, got " +
        (body.error ?? "success") +
        " " +
        (body.error_description ?? ""),
    );
  }
  return body;
}

class Browser {
  constructor(worker, session = sessionA) {
    this.worker = worker;
    this.session = session;
    this.cookies = new Map();
  }

  async request(path, body) {
    if (path.startsWith("http")) {
      const url = new URL(path);
      assert.ok(url.hostname === "127.0.0.1");
      path = url.pathname + url.search;
    }
    const values = [...this.cookies.values()]
      .filter(
        ({ path: prefix }) =>
          path === prefix ||
          path.startsWith(prefix === "/" ? "/" : prefix + "/") ||
          path.startsWith(prefix + "?"),
      )
      .map(({ value }) => value);
    if (this.session) values.push("first_party=" + this.session);
    const headers = { Cookie: values.join("; "), Accept: "application/json" };
    if (body !== undefined) {
      headers.Origin = this.worker.base;
      headers["Content-Type"] = "application/json";
    }
    const response = await http(this.worker, path, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [value, ...attributes] = cookie.split("; ");
      const scope =
        attributes.find((item) => /^path=/i.test(item))?.slice(5) ?? "/";
      const name = value.split("=")[0] + "@" + scope;
      if (value.endsWith("=")) this.cookies.delete(name);
      else this.cookies.set(name, { value, path: scope });
    }
    return response;
  }
}

function authRequest(overrides = {}) {
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(12).toString("hex");
  const parameters = new URLSearchParams({
    client_id: client,
    response_type: "code",
    redirect_uri: redirect,
    resource,
    scope: "read write",
    code_challenge_method: "S256",
    state: nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  for (const [name, value] of Object.entries(overrides)) {
    parameters.delete(name);
    for (const item of [value].flat())
      if (item !== null) parameters.append(name, item);
  }
  return { path: "/auth?" + parameters, verifier, nonce };
}

function location(response) {
  assert.equal(response.status, 303);
  return response.headers.get("location");
}

function callback(response, nonce) {
  const url = new URL(location(response));
  assert.equal(url.origin + url.pathname, redirect);
  assert.ok(url.searchParams.get("state") === nonce);
  if (url.searchParams.has("code"))
    assert.equal(url.searchParams.get("iss"), issuer);
  return url.searchParams;
}

async function pending(browser, overrides) {
  const { path, verifier, nonce } = authRequest(overrides);
  const authorization = await browser.request(path);
  if (authorization.status !== 303) await json(authorization, 303);
  const login = location(authorization);
  const actor = await json(await browser.request(login), 200);
  assert.equal(actor.name, "login");
  const next = location(
    await browser.request(login, { confirm: true, accountId: otherAccount }),
  );
  const consent = location(await browser.request(next));
  const prompt = await json(await browser.request(consent), 200);
  assert.equal(prompt.name, "consent");
  return { verifier, nonce, prompt, consent };
}

async function finish(browser, request, selected) {
  const resume = location(await browser.request(request.consent, { selected }));
  return callback(await browser.request(resume), request.nonce);
}

async function code(browser, selected = ["read", "write"], overrides) {
  const request = await pending(browser, overrides);
  const response = await finish(browser, request, selected);
  assert.ok(
    response.has("code"),
    "Expected code, got " + response.get("error"),
  );
  return { value: response.get("code"), verifier: request.verifier };
}

function token(worker, fields) {
  return http(worker, "/token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({ client_id: client, resource, ...fields }),
  });
}

function exchange(worker, issued, fields) {
  return token(worker, {
    grant_type: "authorization_code",
    code: issued.value,
    code_verifier: issued.verifier,
    redirect_uri: redirect,
    ...fields,
  });
}

function refresh(worker, value, fields) {
  return token(worker, {
    grant_type: "refresh_token",
    refresh_token: value,
    ...fields,
  });
}

async function issue(f, browser = new Browser(f.primary), selected) {
  return json(await exchange(f.primary, await code(browser, selected)), 200);
}

async function admission(
  worker,
  bearer,
  permission,
  expected,
  { aud = resource, subject = account } = {},
) {
  const result = await http(
    worker,
    "/admit?" +
      new URLSearchParams({ resource: aud, account: subject, permission }),
    { headers: { Authorization: "Bearer " + bearer } },
  );
  assert.equal((await json(result, expected ? 200 : 403)).admitted, expected);
}

async function oauthError(response, error, status = 400) {
  const result = await json(response, status);
  if (error) assert.equal(result.error, error);
  else assert.ok(result.error);
  assert.ok(!result.access_token && !result.refresh_token);
}

test("F01 custom login, required read, declined optional write and subject binding", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const request = await pending(browser);
  assert.deepEqual(request.prompt, {
    name: "consent",
    accountId: account,
    clientId: client,
    resource,
    required: ["read"],
    optional: ["write"],
  });
  const response = await finish(browser, request, ["read"]);
  assert.ok(response.has("code"));
  const result = await json(
    await exchange(f.primary, {
      value: response.get("code"),
      verifier: request.verifier,
    }),
    200,
  );
  assert.equal(result.scope, "read");
  assert.ok(result.refresh_token);
  await admission(f.primary, result.access_token, "read", true);
  await admission(f.primary, result.access_token, "write", false);
  await admission(f.primary, result.access_token, "read", false, {
    subject: otherAccount,
  });
  const newRequest = await pending(browser);
  browser.session = sessionB;
  assert.equal(
    (await browser.request(newRequest.consent, { selected: ["read", "write"] }))
      .status,
    403,
  );
  browser.session = sessionA;
  assert.equal(
    (await finish(browser, newRequest, ["write"])).get("error"),
    "access_denied",
  );
  const { entitlements } = await f.mutate((iam) =>
    iam.activeGrant(account, client),
  );
  assert.deepEqual(Object.keys(entitlements), ["read"]);
});

test("F02 S256, verifier/client/redirect binding, one HTTP exchange and standalone atomic consume", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  for (const invalid of [
    { code_challenge_method: "plain" },
    { code_challenge: null, code_challenge_method: null },
  ]) {
    const request = authRequest(invalid);
    const result = callback(await browser.request(request.path), request.nonce);
    assert.equal(result.get("error"), "invalid_request");
  }
  const issued = await code(browser);
  await oauthError(
    await exchange(f.primary, issued, {
      code_verifier: randomBytes(32).toString("base64url"),
    }),
    "invalid_grant",
  );
  await oauthError(
    await exchange(f.primary, issued, { client_id: otherClient }),
    "invalid_grant",
  );
  await oauthError(
    await exchange(f.primary, issued, {
      redirect_uri: redirect + "-different",
    }),
    "invalid_grant",
  );
  await oauthError(
    await token(f.primary, {
      grant_type: "authorization_code",
      code: issued.value,
      code_verifier: issued.verifier,
    }),
    "invalid_request",
  );
  const secondary = await f.start();
  const outcomes = await Promise.all([
    exchange(f.primary, issued),
    exchange(secondary, issued),
  ]);
  assert.deepEqual(outcomes.map((result) => result.status).sort(), [200, 400]);
  const loser = outcomes.find((result) => result.status === 400);
  await oauthError(loser, "invalid_grant");

  const directCode = await code(browser);
  const Adapter = postgresAdapter(
    f.db,
    f.iam,
    f.key,
    () => Promise.resolve(),
    false,
  );
  const consume = () =>
    f.db.transaction(
      () => new Adapter("AuthorizationCode").consume(directCode.value),
      { lock: false },
    );
  const atomic = await Promise.allSettled([consume(), consume()]);
  assert.equal(atomic.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(
    atomic.find(({ status }) => status === "rejected").reason.error,
    "invalid_grant",
  );
});

test("F02 control: native S256 exchange allows omitted redirect_uri", async (t) => {
  const f = await fixture(t, "generations", false);
  const issued = await code(new Browser(f.primary));
  const result = await json(
    await token(f.primary, {
      grant_type: "authorization_code",
      code: issued.value,
      code_verifier: issued.verifier,
    }),
    200,
  );
  assert.ok(result.access_token);
});

test("F03 approved client, resource and scope at authorization, exchange, refresh and admission", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const unknown = await browser.request(
    authRequest({ client_id: "unapproved" }).path,
  );
  assert.equal(unknown.status, 400);
  for (const [input, expected] of [
    [{ resource: "https://elsewhere.example.test" }, "invalid_target"],
    [
      { resource: [resource, "https://elsewhere.example.test"] },
      "invalid_target",
    ],
    [{ resource: null }, "invalid_target"],
    [{ scope: "read unauthorized" }, "invalid_scope"],
    [{ scope: "write" }, "invalid_scope"],
  ]) {
    const request = authRequest(input);
    assert.equal(
      callback(await browser.request(request.path), request.nonce).get("error"),
      expected,
    );
  }
  await f.sql("UPDATE client SET allowed = ARRAY['read'] WHERE id = $1", [
    client,
  ]);
  const disallowed = authRequest();
  assert.equal(
    callback(await browser.request(disallowed.path), disallowed.nonce).get(
      "error",
    ),
    "invalid_scope",
  );
  await f.sql(
    "UPDATE client SET allowed = ARRAY['read', 'write'] WHERE id = $1",
    [client],
  );
  const issued = await code(browser);
  await oauthError(
    await exchange(f.primary, issued, {
      resource: "https://elsewhere.example.test",
    }),
    "invalid_target",
  );
  const result = await json(await exchange(f.primary, issued), 200);
  await oauthError(
    await refresh(f.primary, result.refresh_token, {
      resource: "https://elsewhere.example.test",
    }),
    "invalid_target",
  );
  await admission(f.primary, result.access_token, "read", false, {
    aud: "https://elsewhere.example.test",
  });
  const unexchanged = await code(browser);
  await f.mutate((iam) => iam.setEnabled(client, false));
  const disabled = authRequest();
  const refusal = callback(
    await browser.request(disabled.path),
    disabled.nonce,
  );
  assert.equal(refusal.get("error"), "invalid_client");
  await oauthError(await exchange(f.primary, unexchanged), "invalid_grant");
  await oauthError(
    await refresh(f.primary, result.refresh_token),
    "invalid_grant",
  );
  await admission(f.primary, result.access_token, "read", false);
  assert.equal((await http(f.primary, "/reg", { method: "POST" })).status, 404);
});

test("F04 repeated consent, explicit extension, uniqueness and stale pending consent", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const original = await issue(f, browser, ["read"]);
  const grant = () => f.mutate((iam) => iam.activeGrant(account, client));
  const first = await grant();
  const declined = await pending(browser);
  assert.equal(
    (await finish(browser, declined, [])).get("error"),
    "access_denied",
  );
  assert.deepEqual((await grant()).entitlements, first.entitlements);
  await admission(f.primary, original.access_token, "read", true);

  const other = new Browser(f.primary);
  const prompts = await Promise.all([pending(browser), pending(other)]);
  const extensions = await Promise.all([
    finish(browser, prompts[0], ["read", "write"]),
    finish(other, prompts[1], ["read", "write"]),
  ]);
  assert.ok(extensions.every((value) => value.has("code")));
  assert.equal((await grant()).id, first.id);
  assert.equal(
    (await f.sql("SELECT count(*)::int AS count FROM iam_grant WHERE active"))
      .rows[0].count,
    1,
  );
  assert.ok((await grant()).entitlements.write);
  await admission(f.primary, original.access_token, "write", false);
  const stale = await pending(browser);
  await f.mutate((iam) => iam.revoke(account, client));
  assert.equal(
    (await finish(browser, stale, ["read", "write"])).get("error"),
    "access_denied",
  );
  assert.equal(await grant(), undefined);
  const beforePrompt = authRequest();
  const earlyLogin = location(await browser.request(beforePrompt.path));
  await f.mutate((iam) => iam.revoke(account, client));
  const afterLogin = location(
    await browser.request(earlyLogin, { confirm: true }),
  );
  const lateConsent = location(await browser.request(afterLogin));
  assert.equal(
    (
      await finish(browser, { ...beforePrompt, consent: lateConsent }, ["read"])
    ).get("error"),
    "access_denied",
  );
  assert.equal(await grant(), undefined);
  const refreshGrant = await pending(browser);
  const resume = location(
    await browser.request(refreshGrant.consent, { selected: ["read"] }),
  );
  await f.mutate((iam) => iam.revoke(account, client));
  assert.equal(
    callback(await browser.request(resume), refreshGrant.nonce).get("error"),
    "access_denied",
  );
});

test("F05 revocation between code issue and exchange, and after prior token issue", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const prior = await issue(f, browser);
  const issued = await code(browser);
  await f.mutate((iam) => iam.revoke(account, client));
  await oauthError(await exchange(f.primary, issued), "invalid_grant");
  await oauthError(
    await refresh(f.primary, prior.refresh_token),
    "invalid_grant",
  );
  await admission(f.primary, prior.access_token, "read", false);
  assert.ok(
    (
      await f.sql(
        "SELECT count(*)::int AS count FROM artifact WHERE model='AccessToken'",
      )
    ).rows[0].count > 0,
  );
});

for (const model of ["generations", "family"]) {
  test("F06 withdrawal then regrant with " + model, async (t) => {
    const f = await fixture(t, model);
    const browser = new Browser(f.primary);
    const old = await issue(f, browser);
    const readOnly = await issue(f, browser, ["read"]);
    const oldCode = await code(browser);
    await f.mutate((iam) => iam.withdraw(account, client, "write"));
    await admission(f.primary, old.access_token, "write", false);
    await admission(
      f.primary,
      old.access_token,
      "read",
      model === "generations",
    );
    const refreshResponse = await refresh(f.primary, old.refresh_token);
    let rolled;
    if (model === "generations") {
      rolled = await json(refreshResponse, 200);
      assert.equal(rolled.scope, "read");
      await admission(f.primary, rolled.access_token, "read", true);
    } else {
      await oauthError(refreshResponse, "invalid_grant");
    }
    const fresh = await issue(f, browser);
    await admission(f.primary, fresh.access_token, "write", true);
    await admission(f.primary, readOnly.access_token, "read", true);
    await admission(f.primary, old.access_token, "write", false);
    if (model === "generations") {
      const next = await json(
        await refresh(f.primary, rolled.refresh_token),
        200,
      );
      assert.equal(next.scope, "read");
      await admission(f.primary, next.access_token, "write", false);
      await oauthError(
        await refresh(f.primary, next.refresh_token, { scope: "write" }),
        "invalid_grant",
      );
      assert.equal(
        (await json(await exchange(f.primary, oldCode), 200)).scope,
        "read",
      );
    } else {
      await oauthError(
        await refresh(f.primary, old.refresh_token),
        "invalid_grant",
      );
      await oauthError(await exchange(f.primary, oldCode), "invalid_grant");
    }
    await f.mutate((iam) => iam.withdraw(account, client, "read"));
    await admission(f.primary, fresh.access_token, "write", false);
  });
}

async function waitForFenceWaiter(f) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const {
      rows: [row],
    } = await f.sql(
      `SELECT EXISTS(SELECT 1 FROM pg_locks w
       JOIN pg_locks owner USING (locktype, database, classid, objid, objsubid)
       WHERE w.locktype = 'advisory' AND NOT w.granted AND owner.granted
       AND owner.objsubid = 2 AND owner.classid = 215
       AND owner.objid::bigint = (hashtext(current_schema())::bigint & 4294967295)) AS waiting`,
    );
    if (row.waiting) return;
    await delay(15);
  }
  assert.fail("Expected another connection to wait on the PostgreSQL fence");
}

test("F07 rotation replay and concurrent revocation in both orders across issuer processes", async (t) => {
  const f = await fixture(t);
  const secondary = await f.start();
  const browser = new Browser(f.primary);
  const first = await issue(f, browser);
  const independent = await issue(f, browser);
  const outcomes = await Promise.all([
    refresh(f.primary, first.refresh_token),
    refresh(secondary, first.refresh_token),
  ]);
  assert.deepEqual(outcomes.map(({ status }) => status).sort(), [200, 400]);
  await oauthError(
    outcomes.find(({ status }) => status === 400),
    "invalid_grant",
  );
  const rotated = await json(
    outcomes.find(({ status }) => status === 200),
    200,
  );
  assert.ok(rotated.refresh_token !== first.refresh_token);
  await oauthError(
    await refresh(secondary, rotated.refresh_token),
    "invalid_grant",
  );
  await admission(f.primary, rotated.access_token, "read", false);
  await admission(f.primary, independent.access_token, "read", true);
  assert.ok(await f.mutate((iam) => iam.activeGrant(account, client)));

  // Issuance owns the transaction fence before revocation begins.
  await f.primary.arm("pause");
  const paused = f.primary.paused();
  const renewing = refresh(f.primary, independent.refresh_token);
  assert.equal(await paused, "paused");
  const revoking = f.mutate((iam) => iam.revoke(account, client));
  try {
    await waitForFenceWaiter(f);
  } finally {
    f.primary.release();
  }
  const admittedBefore = await json(await renewing, 200);
  await revoking;
  await admission(secondary, admittedBefore.access_token, "read", false);
  await oauthError(
    await refresh(secondary, admittedBefore.refresh_token),
    "invalid_grant",
  );

  // Revocation owns the fence while a second issuer attempts refresh.
  const fresh = await issue(f, browser);
  const { promise: changed, resolve: signal } = Promise.withResolvers();
  const { promise: release, resolve: allowCommit } = Promise.withResolvers();
  const revocation = f.db.transaction(async () => {
    await f.iam.revoke(account, client);
    signal();
    await release;
  });
  await changed;
  const blockedRenewal = refresh(secondary, fresh.refresh_token);
  try {
    await waitForFenceWaiter(f);
  } finally {
    allowCommit();
  }
  await revocation;
  await oauthError(await blockedRenewal, "invalid_grant");
});

test("F08 disable/re-enable and suspend/reactivate require distinct IAM grant identities", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const ids = new Set();
  const grant = () => f.mutate((iam) => iam.activeGrant(account, client));
  for (const change of [
    (iam, value) => iam.setEnabled(client, value),
    (iam, value) => iam.setEligible(account, value),
  ]) {
    const credentials = await issue(f, browser);
    const stale = await pending(browser);
    ids.add((await grant()).id);
    await f.mutate((iam) => change(iam, false));
    await f.mutate((iam) => change(iam, true));
    assert.equal(await grant(), undefined);
    await oauthError(
      await refresh(f.primary, credentials.refresh_token),
      "invalid_grant",
    );
    await admission(f.primary, credentials.access_token, "read", false);
    assert.equal(
      (await finish(browser, stale, ["read"])).get("error"),
      "access_denied",
    );
  }
  const fresh = await issue(f, browser);
  ids.add((await grant()).id);
  assert.equal(ids.size, 3);
  await admission(f.primary, fresh.access_token, "read", true);
});

test("F09 Web sign-out, Web expiry and provider-session deletion preserve delegated credentials", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const initial = await issue(f, browser);
  const pendingSignOut = await pending(browser);
  await f.sql("DELETE FROM web_session WHERE id = $1", [sessionA]);
  assert.equal(
    (await browser.request(pendingSignOut.consent, { selected: ["read"] }))
      .status,
    403,
  );
  await admission(f.primary, initial.access_token, "read", true);
  browser.session = "synthetic-web-session-replacement";
  await f.sql("INSERT INTO web_session(id, account_id) VALUES ($1, $2)", [
    browser.session,
    account,
  ]);
  const pendingExpiry = await pending(browser);
  await f.sql(
    "UPDATE web_session SET expires_at = now() - interval '1 second' WHERE id = $1",
    [browser.session],
  );
  assert.equal(
    (await browser.request(pendingExpiry.consent, { selected: ["read"] }))
      .status,
    403,
  );
  await f.sql("DELETE FROM artifact WHERE model = 'Session'");
  const rotated = await json(
    await refresh(f.primary, initial.refresh_token),
    200,
  );
  await admission(f.primary, rotated.access_token, "read", true);
});

test("F10 PostgreSQL failure and commit failure, restart, expiry, erasure and output redaction", async (t) => {
  const f = await fixture(t);
  const browser = new Browser(f.primary);
  const issued = await code(browser);
  await f.primary.arm("sql-error");
  await oauthError(await exchange(f.primary, issued), "server_error", 500);
  await f.primary.arm("commit-error");
  await oauthError(await exchange(f.primary, issued), "server_error", 503);
  assert.equal(
    (
      await f.sql(
        "SELECT count(*)::int AS count FROM artifact WHERE model IN ('AccessToken','RefreshToken')",
      )
    ).rows[0].count,
    0,
  );
  const initial = await json(await exchange(f.primary, issued), 200);
  await f.primary.arm("admission-error");
  await oauthError(
    await http(
      f.primary,
      "/admit?" +
        new URLSearchParams({
          resource,
          account,
          permission: "read",
        }),
      { headers: { Authorization: "Bearer " + initial.access_token } },
    ),
    "server_error",
    503,
  );
  await f.primary.arm("sql-error");
  await oauthError(
    await refresh(f.primary, initial.refresh_token),
    "server_error",
    500,
  );
  assert.equal(
    (
      await f.sql(
        "SELECT count(*)::int AS count FROM artifact WHERE model='RefreshToken'",
      )
    ).rows[0].count,
    1,
  );
  const interrupted = await pending(browser);
  await f.primary.stop();
  const restarted = await f.start();
  browser.worker = restarted;
  const result = await finish(browser, interrupted, ["read"]);
  assert.ok(result.has("code"));
  await admission(restarted, initial.access_token, "read", true);
  const rotated = await json(
    await refresh(restarted, initial.refresh_token),
    200,
  );
  assert.ok(rotated.refresh_token !== initial.refresh_token);
  const live = await json(
    await exchange(restarted, {
      value: result.get("code"),
      verifier: interrupted.verifier,
    }),
    200,
  );
  await f.sql(
    "UPDATE artifact SET expires_at = now() - interval '1 second' WHERE model='AccessToken'",
  );
  await admission(restarted, rotated.access_token, "read", false);
  const expiredCode = await code(browser);
  await f.sql(
    "UPDATE artifact SET expires_at = now() - interval '1 second' WHERE model='AuthorizationCode'",
  );
  await oauthError(await exchange(restarted, expiredCode), "invalid_grant");
  const stale = await pending(browser);

  const rows = (
    await f.sql("SELECT row_to_json(artifact)::text AS row FROM artifact")
  ).rows;
  for (const secret of [
    issued.value,
    initial.access_token,
    initial.refresh_token,
    rotated.access_token,
    rotated.refresh_token,
    expiredCode.value,
    live.access_token,
    live.refresh_token,
  ]) {
    assert.ok(
      !rows.some(({ row }) => row.includes(secret)),
      "Bearer credential persisted in cleartext",
    );
    assert.ok(
      !f.primary.logs().includes(secret) && !restarted.logs().includes(secret),
      "Bearer credential leaked to issuer output",
    );
  }
  await f.sql("DELETE FROM account WHERE id = $1", [account]);
  for (const table of [
    "web_session",
    "consent_epoch",
    "pending",
    "iam_grant",
    "artifact",
    "family",
  ]) {
    const column = table === "family" ? "" : " WHERE account_id = $1";
    const query = await f.sql(
      "SELECT count(*)::int AS count FROM " + table + column,
      column ? [account] : [],
    );
    assert.equal(
      query.rows[0].count,
      0,
      "Erasure left linked " + table + " rows",
    );
  }
  await oauthError(
    await refresh(restarted, rotated.refresh_token),
    "invalid_grant",
  );
  assert.equal(
    (await browser.request(stale.consent, { selected: ["read"] })).status,
    400,
  );
});
