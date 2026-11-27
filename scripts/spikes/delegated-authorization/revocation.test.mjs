import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { openDatabase } from "./database.mjs";

const fence = "SELECT pg_advisory_xact_lock(728194002)";
const shared = "SELECT pg_advisory_xact_lock_shared(728194002)";

async function fixture(t) {
  const schema = "spike215_" + randomUUID().replaceAll("-", "");
  const { pool } = openDatabase(schema);
  t.after(async () => {
    try {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await pool.end();
    }
  });
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`
    CREATE TABLE account (id integer PRIMARY KEY);
    CREATE TABLE grant_row (
      account_id integer NOT NULL REFERENCES account, client integer NOT NULL,
      resource integer NOT NULL, active boolean NOT NULL DEFAULT true,
      PRIMARY KEY (account_id, client, resource)
    );
    CREATE INDEX active_by_client ON grant_row (client, account_id, resource) WHERE active;
    CREATE TABLE outbox (
      operation uuid NOT NULL, account_id integer NOT NULL,
      grant_count integer NOT NULL CHECK (grant_count > 0),
      PRIMARY KEY (operation, account_id)
    );
  `);
  return pool;
}

async function seed(pool, accounts) {
  await pool.query("INSERT INTO account SELECT generate_series(1, $1::int)", [
    accounts,
  ]);
  await pool.query(`
    INSERT INTO grant_row (account_id, client, resource)
      SELECT a.id, 1, r FROM account a CROSS JOIN generate_series(1, 3) r
      UNION ALL
      SELECT a.id, 2, 1 FROM account a WHERE a.id % 10 = 0
      UNION ALL
      SELECT 1, client, 1 FROM generate_series(3, 52) client
  `);
  await pool.query("ANALYZE grant_row");
}

async function counts(pool) {
  return (
    await pool.query(`SELECT
    (SELECT count(*)::int FROM grant_row WHERE active AND client = 1) AS active,
    (SELECT count(*)::int FROM grant_row WHERE active AND client <> 1) AS unaffected,
    (SELECT count(*)::int FROM outbox) AS events,
    (SELECT coalesce(sum(grant_count),0)::int FROM outbox) AS revoked`)
  ).rows[0];
}

async function revoke(connection, operation, column, identity) {
  const predicate = column === "client" ? "client = $2" : "account_id = $2";
  return connection.query(
    `
    WITH revoked AS (
      UPDATE grant_row SET active = false WHERE active AND ${predicate}
      RETURNING account_id
    ), grouped AS (
      SELECT account_id, count(*)::int AS grant_count FROM revoked GROUP BY account_id
    )
    INSERT INTO outbox(operation, account_id, grant_count)
      SELECT $1, account_id, grant_count FROM grouped ORDER BY account_id
  `,
    [operation, identity],
  );
}

async function transaction(pool, run) {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const value = await run(connection);
    await connection.query("COMMIT");
    return value;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

for (const accounts of [1000, 10000]) {
  test(
    "P05 client-wide revocation and grouped transactional fan-out for " +
      accounts +
      " accounts",
    async (t) => {
      const pool = await fixture(t);
      await seed(pool, accounts);
      const operation = randomUUID();

      await assert.rejects(
        transaction(pool, async (connection) => {
          await connection.query(fence);
          await revoke(connection, operation, "client", 1);
          await connection.query("INSERT INTO outbox VALUES ($1, 1, 0)", [
            randomUUID(),
          ]);
        }),
        { code: "23514" },
      );
      assert.deepEqual(await counts(pool), {
        active: 3 * accounts,
        unaffected: accounts / 10 + 50,
        events: 0,
        revoked: 0,
      });

      const { promise: acquired, resolve: markAcquired } =
        Promise.withResolvers();
      const { promise: proceed, resolve: release } = Promise.withResolvers();
      const { promise: waiting, resolve: markWaiting } =
        Promise.withResolvers();
      let mutationMs;
      let exclusiveMs;
      const mutation = transaction(pool, async (connection) => {
        await connection.query(fence);
        const acquiredAt = performance.now();
        markAcquired();
        await proceed;
        const started = performance.now();
        assert.equal(
          (await revoke(connection, operation, "client", 1)).rowCount,
          accounts,
        );
        mutationMs = performance.now() - started;
        return acquiredAt;
      }).then((started) => {
        exclusiveMs = performance.now() - started;
      });
      await acquired;

      const admission = transaction(pool, async (connection) => {
        const result = await connection.query(
          "SELECT pg_try_advisory_xact_lock_shared(728194002) AS granted",
        );
        assert.equal(result.rows[0].granted, false);
        markWaiting();
        const started = performance.now();
        await connection.query(shared);
        const waitMs = performance.now() - started;
        const {
          rows: [row],
        } = await connection.query(
          "SELECT count(*)::int AS active FROM grant_row WHERE active AND client = 1",
        );
        assert.equal(row.active, 0);
        return waitMs;
      });
      await waiting;
      release();
      const [, waitMs] = await Promise.all([mutation, admission]);
      const after = await counts(pool);
      assert.deepEqual(after, {
        active: 0,
        unaffected: accounts / 10 + 50,
        events: accounts,
        revoked: 3 * accounts,
      });
      assert.equal(
        (
          await transaction(pool, async (connection) => {
            await connection.query(fence);
            return revoke(connection, operation, "client", 1);
          })
        ).rowCount,
        0,
      );

      t.diagnostic(
        JSON.stringify({
          accounts,
          revoked: after.revoked,
          groupedEvents: after.events,
          mutationMs: +mutationMs.toFixed(1),
          exclusiveMs: +exclusiveMs.toFixed(1),
          competingAdmissionWaitMs: +waitMs.toFixed(1),
        }),
      );
    },
  );
}

test("P06 account-wide revocation creates one grouped fact across clients and resources", async (t) => {
  const pool = await fixture(t);
  await seed(pool, 1000);
  const operation = randomUUID();
  const started = performance.now();
  await transaction(pool, async (connection) => {
    await connection.query(fence);
    assert.equal(
      (await revoke(connection, operation, "account", 1)).rowCount,
      1,
    );
  });
  assert.deepEqual(await counts(pool), {
    active: 2997,
    unaffected: 100,
    events: 1,
    revoked: 53,
  });
  t.diagnostic(
    JSON.stringify({
      revoked: 53,
      groupedEvents: 1,
      transactionMs: +(performance.now() - started).toFixed(1),
    }),
  );
});

test("P07 PostgreSQL detects an account-before-fence inversion", async (t) => {
  const pool = await fixture(t);
  await pool.query("INSERT INTO account VALUES (1)");
  const earlyAccount = await pool.connect();
  const earlyFence = await pool.connect();
  const row = "SELECT id FROM account WHERE id = 1 FOR UPDATE";
  try {
    await earlyAccount.query("BEGIN");
    await earlyFence.query("BEGIN");
    await earlyAccount.query(row);
    await earlyFence.query(fence);
    const contend = async (connection, statement) => {
      try {
        await connection.query(statement);
      } finally {
        await connection.query("ROLLBACK");
      }
    };
    const results = await Promise.allSettled([
      contend(earlyFence, row),
      contend(earlyAccount, fence),
    ]);
    assert.deepEqual(
      results.flatMap((result) =>
        result.status === "rejected" ? [result.reason.code] : [],
      ),
      ["40P01"],
    );
  } finally {
    try {
      await earlyAccount.query("ROLLBACK");
      await earlyFence.query("ROLLBACK");
    } finally {
      earlyAccount.release();
      earlyFence.release();
    }
  }
});
