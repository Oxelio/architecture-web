import { randomUUID } from "node:crypto";

import type {
  ConfigurationRevision,
  ConfigurationStore,
} from "@architecture/iam/application";
import { createIamSecurityEvent } from "@architecture/iam/application";
import {
  changedPolicyKeys,
  DEFAULT_SECURITY_POLICY,
  parseStoredSecurityPolicy,
  policyValue,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import { type Kysely, sql } from "kysely";

import type { IamDatabase } from "#persistence/schema";

import {
  hasAdministrativeAccess,
  lockAdministrativeAccess,
} from "./administrative-access.js";
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
    representation_version: number;
    comparison_data: { key: string; before: unknown; after: unknown }[] | null;
    published_at: Date | null;
    status: string;
    justification: string | null;
    origin: string | null;
    restored_from_revision_id: string | null;
  }) {
    return {
      id: row.id,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      previousRevisionId: row.previous_revision_id,
      representationVersion: row.representation_version,
      status: row.status,
      publishedAt: row.published_at,
      changes: row.comparison_data,
      justification: row.justification,
      origin: row.origin,
      restoredFromRevisionId: row.restored_from_revision_id,
    };
  }
  private revision(row: {
    id: string;
    version: number;
    values: unknown;
    created_by: string;
    created_at: Date;
    previous_revision_id: string | null;
    representation_version: number;
    comparison_data: { key: string; before: unknown; after: unknown }[] | null;
    published_at: Date | null;
    status: string;
    justification: string | null;
    origin: string | null;
    restored_from_revision_id: string | null;
  }): ConfigurationRevision {
    const parsed = parseStoredSecurityPolicy(
      row.values,
      row.representation_version,
    );
    if (!parsed.success) {
      throw new Error(
        `Unsupported or corrupt IAM configuration revision ${row.id} (representation ${row.representation_version})`,
      );
    }
    return { ...this.metadata(row), values: parsed.value };
  }
  async initialize() {
    await this.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(728194001)`.execute(trx);
      const existing = await trx
        .selectFrom("iam_security_config_revisions")
        .select("id")
        .where("status", "=", "published")
        .executeTakeFirst();
      if (existing) {
        const stored = await trx
          .selectFrom("iam_security_config_revisions")
          .selectAll()
          .where("id", "=", existing.id)
          .executeTakeFirstOrThrow();
        this.revision(stored);
      } else {
        const historical = await trx
          .selectFrom("iam_security_config_revisions")
          .select("id")
          .executeTakeFirst();
        if (historical) {
          throw new Error(
            "IAM configuration history exists without a published revision",
          );
        }
        await trx
          .insertInto("iam_security_config_revisions")
          .values({
            id: randomUUID(),
            version: 1,
            status: "published",
            values: JSON.stringify(DEFAULT_SECURITY_POLICY),
            representation_version: 2,
            origin: "initialization",
            justification: "Deployment initialization",
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
  async readCenter() {
    return this.db
      .transaction()
      .setIsolationLevel("repeatable read")
      .execute(async (trx) => {
        const reader = new KyselySecurityConfigurationAdapter(trx, this.outbox);
        return {
          published: await reader.readPublished(),
          revisions: await reader.history(),
        };
      });
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
    return row ? this.revision(row) : null;
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
      await lockAdministrativeAccess(trx);
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
      const actor = await trx
        .selectFrom("iam_users")
        .selectAll()
        .where("id", "=", input.actorId)
        .forUpdate()
        .executeTakeFirst();
      if (!actor || actor.role !== "admin" || actor.status !== "active") {
        return "unauthorized" as const;
      }
      if (
        input.expectedActorSessionVersion !== undefined &&
        actor.session_version !== input.expectedActorSessionVersion
      ) {
        return "reauthentication_required" as const;
      }
      if (!(await hasAdministrativeAccess(trx, input.values))) {
        return "last_administrator" as const;
      }
      const previous = this.revision(current);
      const changedKeys = changedPolicyKeys(previous.values, input.values);
      const changes = changedKeys.map((key) => ({
        key,
        before: policyValue(previous.values, key),
        after: policyValue(input.values, key),
      }));
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
          representation_version: 2,
          comparison_data: sql<
            { key: string; before: unknown; after: unknown }[]
          >`${JSON.stringify(changes)}::jsonb`,
          justification: input.justification,
          origin: input.origin ?? "administration",
          restored_from_revision_id: input.restoredFromRevisionId ?? null,
          created_by: input.actorId,
          created_at: now,
          published_at: now,
          previous_revision_id: current.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "security.config.published",
          eventId: randomUUID(),
          occurredAt: now,
          revisionId: id,
          actorId: input.actorId,
          version: row.version,
          changedKeys,
          justification: input.justification,
        }),
      ]);
      return this.revision(row);
    });
  }
}
