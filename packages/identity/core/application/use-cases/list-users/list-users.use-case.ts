import { Result } from "@architecture/foundation";

import type { UserAdministrationRepository } from "#repositories/user.repository";

import type {
  AdminUser,
  ListUsers,
  ListUsersOutput,
} from "./list-users.contracts.js";

export class ListUsersUseCase implements ListUsers {
  constructor(private readonly users: UserAdministrationRepository) {}

  async execute(): Promise<ListUsersOutput> {
    const users = await this.users.findAll();

    return Result.success(
      users.map((user): AdminUser => ({
        userId: user.identifier.value,
        email: user.email.value,
        role: user.role.value,
        status: user.status.value,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
    );
  }
}
