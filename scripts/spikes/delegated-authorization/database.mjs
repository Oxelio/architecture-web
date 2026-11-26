import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pg from "pg";

export const resource = "https://resource.example.test/account";
export const redirect = "https://client.example.test/callback";
export const permissions = (scope = "") => scope.split(" ").filter(Boolean);

export const schemaSql = `
  CREATE TABLE account (id text PRIMARY KEY, eligible boolean NOT NULL DEFAULT true);
  CREATE TABLE commit_probe (
    account_id text REFERENCES account DEFERRABLE INITIALLY DEFERRED
  );
  CREATE TABLE client (id text PRIMARY KEY, enabled boolean NOT NULL DEFAULT true,
    allowed text[] NOT NULL DEFAULT ARRAY['read', 'write']);
  CREATE TABLE web_session (
    id text PRIMARY KEY, account_id text NOT NULL REFERENCES account ON DELETE CASCADE,
    expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour'
  );
  CREATE TABLE consent_epoch (
    account_id text NOT NULL REFERENCES account ON DELETE CASCADE,
    client_id text NOT NULL REFERENCES client, revision bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, client_id)
  );
  CREATE TABLE iam_grant (
    id uuid PRIMARY KEY, account_id text NOT NULL REFERENCES account ON DELETE CASCADE,
    client_id text NOT NULL REFERENCES client, resource text NOT NULL,
    active boolean NOT NULL DEFAULT true, entitlements jsonb NOT NULL
  );
  CREATE UNIQUE INDEX one_active_grant ON iam_grant(account_id, client_id, resource) WHERE active;
  CREATE TABLE family (
    id text PRIMARY KEY, grant_id uuid NOT NULL REFERENCES iam_grant ON DELETE CASCADE,
    entitlements jsonb NOT NULL, active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE pending (
    id text PRIMARY KEY, account_id text NOT NULL REFERENCES account ON DELETE CASCADE,
    client_id text NOT NULL REFERENCES client, session_id text NOT NULL,
    revision bigint NOT NULL, expires_at timestamptz NOT NULL DEFAULT now() + interval '3 minutes'
  );
  CREATE TABLE artifact (
    model text NOT NULL, id text NOT NULL, payload jsonb NOT NULL,
    account_id text REFERENCES account ON DELETE CASCADE, family_id text,
    uid text, user_code text, consumed integer, expires_at timestamptz,
    PRIMARY KEY (model, id)
  );
  CREATE INDEX artifact_family ON artifact(family_id);
  CREATE INDEX artifact_account ON artifact(account_id);
  CREATE INDEX artifact_uid ON artifact(model, uid);
  CREATE INDEX artifact_user_code ON artifact(model, user_code);
`;

export function openDatabase(schema) {
  if (!/^spike215_[a-f0-9]{32}$/.test(schema))
    throw new Error("Expected a generated spike schema");
  const url = new URL(process.env.SPIKE_DATABASE_URL);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "spike" ||
    url.pathname !== "/spike" ||
    url.search ||
    url.password
  ) {
    throw new Error("Expected the local disposable spike database");
  }
  const pool = new pg.Pool({
    connectionString: url.href,
    connectionTimeoutMillis: 3000,
    options: `-c search_path=${schema} -c statement_timeout=6000 -c idle_in_transaction_session_timeout=8000`,
  });
  const requests = new AsyncLocalStorage();

  async function transaction(run, options = {}) {
    const connection = await pool.connect();
    let open = false;
    try {
      await connection.query("BEGIN");
      open = true;
      // One fence per fixture makes the two orderings explicit. Production lock
      // granularity and ordering are design questions.
      if (options.lock !== false) {
        await connection.query(
          "SELECT pg_advisory_xact_lock(215, hashtext($1))",
          [schema],
        );
      }
      const state = {
        connection,
        actor: undefined,
        replay: false,
        rollback: false,
        ...options,
      };
      const value = await requests.run(state, () => run(state));
      await connection.query(state.rollback ? "ROLLBACK" : "COMMIT");
      open = false;
      return value;
    } finally {
      try {
        if (open) await connection.query("ROLLBACK");
      } finally {
        connection.release();
      }
    }
  }

  function state() {
    const current = requests.getStore();
    if (!current) throw new Error("Expected a request transaction");
    return current;
  }

  function query(sql, parameters) {
    return state().connection.query(sql, parameters);
  }

  async function one(sql, parameters) {
    return (await query(sql, parameters)).rows[0];
  }

  return { pool, one, query, state, transaction };
}

export function createIam(db, mode) {
  const { one, query } = db;
  const client = (id) =>
    one("SELECT * FROM client WHERE id = $1 AND enabled", [id]);
  const eligible = (id) =>
    one("SELECT id FROM account WHERE id = $1 AND eligible", [id]);
  const session = (key) =>
    one(
      `SELECT s.id, s.account_id FROM web_session s JOIN account a ON a.id = s.account_id
     WHERE s.id = $1 AND s.expires_at > now() AND a.eligible`,
      [key ?? null],
    );
  const activeGrant = (accountId, clientId) =>
    one(
      "SELECT * FROM iam_grant WHERE account_id = $1 AND client_id = $2 AND resource = $3 AND active",
      [accountId, clientId, resource],
    );

  async function epoch(accountId, clientId) {
    await query(
      "INSERT INTO consent_epoch (account_id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [accountId, clientId],
    );
    return (
      await one(
        "SELECT revision FROM consent_epoch WHERE account_id = $1 AND client_id = $2",
        [accountId, clientId],
      )
    ).revision;
  }

  async function captureConsent(id, session, clientId) {
    const revision = await epoch(session.account_id, clientId);
    await query(
      `INSERT INTO pending (id, account_id, client_id, session_id, revision)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [id, session.account_id, clientId, session.id, revision],
    );
  }

  async function invalidate(grants) {
    for (const grant of grants) {
      await query("UPDATE iam_grant SET active = false WHERE id = $1", [
        grant.id,
      ]);
    }
  }

  async function revoke(accountId, clientId) {
    await epoch(accountId, clientId);
    await query(
      "UPDATE consent_epoch SET revision = revision + 1 WHERE account_id = $1 AND client_id = $2",
      [accountId, clientId],
    );
    const grant = await activeGrant(accountId, clientId);
    if (grant) await invalidate([grant]);
  }

  async function setEligible(id, value) {
    await query("UPDATE account SET eligible = $2 WHERE id = $1", [id, value]);
    if (!value) {
      await query(
        "UPDATE consent_epoch SET revision = revision + 1 WHERE account_id = $1",
        [id],
      );
      await invalidate(
        (
          await query(
            "SELECT id FROM iam_grant WHERE account_id = $1 AND active",
            [id],
          )
        ).rows,
      );
    }
  }

  async function setEnabled(id, value) {
    await query("UPDATE client SET enabled = $2 WHERE id = $1", [id, value]);
    if (!value) {
      await query(
        "UPDATE consent_epoch SET revision = revision + 1 WHERE client_id = $1",
        [id],
      );
      await invalidate(
        (
          await query(
            "SELECT id FROM iam_grant WHERE client_id = $1 AND active",
            [id],
          )
        ).rows,
      );
    }
  }

  async function withdraw(accountId, clientId, permission) {
    if (permission === "read") return revoke(accountId, clientId);
    const grant = await activeGrant(accountId, clientId);
    if (!grant?.entitlements[permission]) return;
    await query(
      "UPDATE iam_grant SET entitlements = entitlements - $2::text WHERE id = $1",
      [grant.id, permission],
    );
    await query(
      "UPDATE consent_epoch SET revision = revision + 1 WHERE account_id = $1 AND client_id = $2",
      [accountId, clientId],
    );
    if (mode === "family") {
      await query(
        "UPDATE family SET active = false WHERE grant_id = $1 AND entitlements ? $2",
        [grant.id, permission],
      );
    }
  }

  async function approve(accountId, clientId, selected) {
    let grant = await activeGrant(accountId, clientId);
    const entitlements = { ...grant?.entitlements };
    for (const permission of selected)
      entitlements[permission] ??= randomUUID();
    if (grant) {
      await query("UPDATE iam_grant SET entitlements = $2 WHERE id = $1", [
        grant.id,
        entitlements,
      ]);
    } else {
      grant = await one(
        `INSERT INTO iam_grant (id, account_id, client_id, resource, entitlements)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [randomUUID(), accountId, clientId, resource, entitlements],
      );
    }
    return {
      grantId: grant.id,
      entitlements: Object.fromEntries(
        selected.map((name) => [name, entitlements[name]]),
      ),
    };
  }

  async function family(id) {
    const row = await one(
      `SELECT g.id AS grant_id, g.account_id, g.client_id, g.resource, c.allowed,
         g.entitlements AS current, f.entitlements AS original
       FROM family f JOIN iam_grant g ON g.id = f.grant_id
       JOIN client c ON c.id = g.client_id JOIN account a ON a.id = g.account_id
       WHERE f.id = $1 AND f.active AND g.active AND c.enabled AND a.eligible`,
      [id],
    );
    if (!row) return;
    row.scope = Object.keys(row.original).filter(
      (name) =>
        row.original[name] === row.current[name] && row.allowed.includes(name),
    );
    if (row.scope.includes("read")) return row;
  }

  return {
    client,
    eligible,
    session,
    activeGrant,
    epoch,
    captureConsent,
    revoke,
    setEligible,
    setEnabled,
    withdraw,
    approve,
    family,
  };
}
