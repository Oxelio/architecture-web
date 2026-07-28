import { Result } from "@architecture/foundation";

import type { UserAdministrationRepository } from "#repositories/user.repository";
import { AdministratorAuthorizer } from "#services/administrator-authorizer.service";

import type {
  AdminUser,
  ListUsers,
  ListUsersInput,
  ListUsersOutput,
} from "./list-users.contracts.js";

export class ListUsersUseCase implements ListUsers {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(private readonly users: UserAdministrationRepository) {
    this.authorizer = new AdministratorAuthorizer(users);
  }

  async execute(input: ListUsersInput): Promise<ListUsersOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

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
