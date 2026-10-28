import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { UserRepository } from "#repositories/user.repository";
import type { UserQueryRepository } from "#repositories/user-query.repository";

import {
  type AdminUser,
  type ListUsers,
  ListUsersErrorCodes,
  type ListUsersInput,
  type ListUsersOutput,
  USER_LIST_DEFAULT_PAGE,
  USER_LIST_DEFAULT_PAGE_SIZE,
  USER_LIST_MAX_PAGE_SIZE,
} from "./list-users.contracts.js";

export class ListUsersUseCase implements ListUsers {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    users: UserRepository,
    private readonly userQuery: UserQueryRepository,
  ) {
    this.authorizer = new AdministratorAuthorizer(users);
  }

  async execute(input: ListUsersInput): Promise<ListUsersOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const page = input.page ?? USER_LIST_DEFAULT_PAGE;
    const pageSize = input.pageSize ?? USER_LIST_DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(page) || page < 1) {
      return Result.failure(ListUsersErrorCodes.invalidPage);
    }
    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > USER_LIST_MAX_PAGE_SIZE
    ) {
      return Result.failure(ListUsersErrorCodes.invalidPageSize);
    }

    const normalizedSearch = input.search?.trim();
    const result = await this.userQuery.search({
      page,
      pageSize,
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.isEmailVerified === undefined
        ? {}
        : { isEmailVerified: input.isEmailVerified }),
    });

    return Result.success({
      users: result.users.map((user): AdminUser => ({
        userId: user.userId,
        loginIdentifiers: user.identifiers,
        email:
          user.identifiers.find((identifier) => identifier.kind === "email")
            ?.value ?? null,
        role: user.role,
        status: user.status,
        isEmailVerified:
          user.identifiers.find((identifier) => identifier.kind === "email")
            ?.verificationStatus === "verified",
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  }
}
