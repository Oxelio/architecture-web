import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { AdministratorAuthorizer } from "#services/administrator-authorizer.service";

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

  constructor(private readonly users: UserRepository) {
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
    const result = await this.users.search({
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
        userId: user.identifier.value,
        email: user.email.value,
        role: user.role.value,
        status: user.status.value,
        isEmailVerified: user.isEmailVerified,
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
