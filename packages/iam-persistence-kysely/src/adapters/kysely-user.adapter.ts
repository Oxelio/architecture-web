// @file infrastructure/iam/persitence/kysely/src/adapters/kysely-user.adapter.ts

import type {
  UserAccountView,
  UserQueryRepository,
  UserRepository,
  UserSearchCriteria,
  UserSearchResult,
} from "@architecture/iam/application";
import { toIamIntegrationEvent as mapDomainEvent } from "@architecture/iam/application";
import type { UserEntity } from "@architecture/iam/domain";
import { UserIdentifierValueObject } from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import { type Kysely, type SelectQueryBuilder, sql } from "kysely";

import { UserMapper } from "#mappers/user.mapper";
import type { IamDatabase } from "#persistence/schema";

export class KyselyUserAdapter implements UserRepository, UserQueryRepository {
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
          role: row.role,
          status: row.status,
          session_version: row.session_version,
          updated_at: row.updated_at,
        }),
      )
      .execute();

    if (this.outbox) {
      await this.outbox.append(user.pullDomainEvents().map(mapDomainEvent));
    }
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

  async findAccountById(userId: string): Promise<UserAccountView | null> {
    const user = await this.db
      .selectFrom("iam_users")
      .selectAll()
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) {
      return null;
    }
    const identifiers = await this.db
      .selectFrom("iam_login_identities")
      .select(["kind", "normalized_value", "verification_status"])
      .where("user_id", "=", userId)
      .orderBy("created_at", "asc")
      .execute();
    return this.toAccountView(user, identifiers);
  }

  async search(criteria: UserSearchCriteria): Promise<UserSearchResult> {
    const applyCriteria = (
      query: SelectQueryBuilder<IamDatabase, "iam_users", object>,
    ) => {
      let filtered = query;
      if (criteria.search !== undefined) {
        const pattern = `%${criteria.search}%`;
        filtered = filtered.where(
          sql<boolean>`(
            iam_users.id::text ilike ${pattern}
            or exists (
              select 1 from iam_login_identities identity
              where identity.user_id = iam_users.id
              and identity.normalized_value ilike ${pattern}
            )
          )`,
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
          criteria.isEmailVerified
            ? sql<boolean>`exists (
                select 1 from iam_login_identities identity
                where identity.user_id = iam_users.id
                and identity.kind = 'email'
                and identity.verification_status = 'verified'
              )`
            : sql<boolean>`not exists (
                select 1 from iam_login_identities identity
                where identity.user_id = iam_users.id
                and identity.kind = 'email'
                and identity.verification_status = 'verified'
              )`,
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

    const userIds = users.map((user) => user.id);
    const identifiers =
      userIds.length === 0
        ? []
        : await this.db
            .selectFrom("iam_login_identities")
            .select([
              "user_id",
              "kind",
              "normalized_value",
              "verification_status",
            ])
            .where("user_id", "in", userIds)
            .orderBy("created_at", "asc")
            .execute();

    return {
      users: users.map((user) =>
        this.toAccountView(
          user,
          identifiers.filter((identity) => identity.user_id === user.id),
        ),
      ),
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

  private toAccountView(
    user: IamDatabase["iam_users"],
    identifiers: readonly {
      readonly kind: string;
      readonly normalized_value: string;
      readonly verification_status: string;
    }[],
  ): UserAccountView {
    return {
      userId: user.id,
      role: user.role as UserAccountView["role"],
      status: user.status as UserAccountView["status"],
      identifiers: identifiers.map((identity) => ({
        kind: identity.kind as "username" | "email",
        value: identity.normalized_value,
        verificationStatus: identity.verification_status as
          "not_required" | "pending" | "verified",
      })),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
