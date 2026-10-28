import { randomUUID } from "node:crypto";

import type {
  ConfigurationRevision,
  ConfigurationStore,
} from "@architecture/iam/application";
import {
  DEFAULT_SECURITY_POLICY,
  parseSecurityPolicy,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import { type Kysely, sql } from "kysely";

import type { IamDatabase } from "#persistence/schema";
export class KyselySecurityConfigurationAdapter implements ConfigurationStore {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox: (transaction: Kysely<IamDatabase>) => OutboxWriter,
  ) {}
  private metadata(row: {
    id: string;
    version: number;
    created_by: string;
    created_at: Date;
    previous_revision_id: string | null;
  }) {
    return {
      id: row.id,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      previousRevisionId: row.previous_revision_id,
    };
  }
  private revision(row: {
    id: string;
    version: number;
    values: unknown;
    created_by: string;
    created_at: Date;
    previous_revision_id: string | null;
  }): ConfigurationRevision {
    const parsed = parseSecurityPolicy(row.values);
    if (!parsed.success) {
      throw new Error("Invalid persisted IAM configuration");
    }
    return {
      id: row.id,
      version: row.version,
      values: parsed.value,
      createdBy: row.created_by,
      createdAt: row.created_at,
      previousRevisionId: row.previous_revision_id,
    };
  }
  async initialize() {
    await this.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(728194001)`.execute(trx);
      const existing = await trx
        .selectFrom("iam_security_config_revisions")
        .select("id")
        .where("status", "=", "published")
        .executeTakeFirst();
      if (!existing) {
        await trx
          .insertInto("iam_security_config_revisions")
          .values({
            id: randomUUID(),
            version: 1,
            status: "published",
            values: JSON.stringify(DEFAULT_SECURITY_POLICY),
            created_by: "00000000-0000-0000-0000-000000000000",
            created_at: new Date(),
            published_at: new Date(),
            previous_revision_id: null,
          })
          .execute();
      }
    });
  }
  async readPublished() {
    return this.revision(
      await this.db
        .selectFrom("iam_security_config_revisions")
        .selectAll()
        .where("status", "=", "published")
        .orderBy("version", "desc")
        .executeTakeFirstOrThrow(),
    );
  }
  async history() {
    return (
      await this.db
        .selectFrom("iam_security_config_revisions")
        .selectAll()
        .orderBy("version", "desc")
        .limit(50)
        .execute()
    ).map((row) => this.metadata(row));
  }
  async find(id: string) {
    const row = await this.db
      .selectFrom("iam_security_config_revisions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? { ...this.metadata(row), values: row.values } : null;
  }
  async countAdministratorsWithoutMfa() {
    const row = await this.db
      .selectFrom("iam_users")
      .leftJoin("iam_mfa_settings", "iam_users.id", "iam_mfa_settings.user_id")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("iam_users.role", "=", "admin")
      .where("iam_users.status", "=", "active")
      .where("iam_mfa_settings.enabled_at", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
  async publish(input: Parameters<ConfigurationStore["publish"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(728194001)`.execute(trx);
      const current = await trx
        .selectFrom("iam_security_config_revisions")
        .selectAll()
        .where("status", "=", "published")
        .orderBy("version", "desc")
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (current.version !== input.expectedVersion) {
        return null;
      }
      const id = randomUUID(),
        now = new Date();
      await trx
        .updateTable("iam_security_config_revisions")
        .set({ status: "superseded" })
        .where("id", "=", current.id)
        .execute();
      const row = await trx
        .insertInto("iam_security_config_revisions")
        .values({
          id,
          version: current.version + 1,
          status: "published",
          values: JSON.stringify(input.values),
          created_by: input.actorId,
          created_at: now,
          published_at: now,
          previous_revision_id: current.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.outbox(trx).append([
        {
          eventId: randomUUID(),
          topic: "security.config.published",
          version: 1,
          aggregateId: id,
          occurredAt: now,
          payload: {
            version: row.version,
            changedKeys: input.changedKeys,
            justification: input.justification,
          },
          context: {
            actorType: "administrator",
            actorId: input.actorId,
            subjectId: input.actorId,
          },
        },
      ]);
      return this.revision(row);
    });
  }
}
