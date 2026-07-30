// @file infrastructure/iam/persitence/kysely/src/adapters/kysely-user.adapter.ts

import type {
  UserRepository,
  UserSearchCriteria,
  UserSearchResult,
} from "@architecture/iam/application";
import { toIamIntegrationEvent as mapDomainEvent } from "@architecture/iam/application";
import type { UserEntity } from "@architecture/iam/domain";
import {
  EmailValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging";
import { type Kysely, type SelectQueryBuilder, sql } from "kysely";

import { UserMapper } from "#mappers/user.mapper";
import type { IamDatabase } from "#persistence/schema";

export class KyselyUserAdapter implements UserRepository {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox?: OutboxWriter,
  ) {}

  async save(user: UserEntity): Promise<void> {
    const row = UserMapper.toPersistence(user);

    await this.db
      .insertInto("iam_users")
      .values(row)
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          email: row.email,
          password_hash: row.password_hash,
          role: row.role,
          status: row.status,
          is_email_verified: row.is_email_verified,
          session_version: row.session_version,
          updated_at: row.updated_at,
        }),
      )
      .execute();

    if (this.outbox) {
      await this.outbox.append(user.pullDomainEvents().map(mapDomainEvent));
    }
  }

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    const user = await this.db
      .selectFrom("iam_users")
      .selectAll()
      .where("email", "=", email.value)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    const user = await this.db
      .selectFrom("iam_users")
      .selectAll()
      .where("id", "=", id.value)
      .executeTakeFirst();

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async search(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    const applyCriteria = (
      query: SelectQueryBuilder<IamDatabase, "iam_users", object>,
    ) => {
      let filtered = query;
      if (criteria.search !== undefined) {
        const pattern = `%${criteria.search}%`;
        filtered = filtered.where(({ eb, or }) =>
          or([eb("email", "ilike", pattern), eb("id", "like", pattern)]),
        );
      }
      if (criteria.role !== undefined) {
        filtered = filtered.where("role", "=", criteria.role);
      }
      if (criteria.status !== undefined) {
        filtered = filtered.where("status", "=", criteria.status);
      }
      if (criteria.isEmailVerified !== undefined) {
        filtered = filtered.where(
          "is_email_verified",
          "=",
          criteria.isEmailVerified,
        );
      }
      return filtered;
    };

    const countRow = await applyCriteria(this.db.selectFrom("iam_users"))
      .select(({ fn }) => fn.countAll().as("total"))
      .executeTakeFirstOrThrow();
    const users = await applyCriteria(this.db.selectFrom("iam_users"))
      .selectAll()
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(criteria.pageSize)
      .offset((criteria.page - 1) * criteria.pageSize)
      .execute();

    return {
      users: users.map(UserMapper.toDomain),
      total: Number(countRow.total),
    };
  }

  async getAdministrationOverview() {
    const row = await this.db
      .selectFrom("iam_users")
      .select([
        sql<number>`count(*)`.as("total"),
        sql<number>`count(*) filter (where status = 'active')`.as("active"),
        sql<number>`count(*) filter (where status = 'suspended')`.as(
          "suspended",
        ),
        sql<number>`count(*) filter (where role = 'admin')`.as(
          "administrators",
        ),
      ])
      .executeTakeFirstOrThrow();

    return {
      total: Number(row.total),
      active: Number(row.active),
      suspended: Number(row.suspended),
      administrators: Number(row.administrators),
    };
  }
}
