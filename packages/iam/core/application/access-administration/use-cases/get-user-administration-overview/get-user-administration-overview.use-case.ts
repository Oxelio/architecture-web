import type { UserRepository } from "#repositories/user.repository";
import { AdministratorAuthorizer } from "#services/administrator-authorizer.service";

import type {
  GetUserAdministrationOverview,
  GetUserAdministrationOverviewInput,
  GetUserAdministrationOverviewOutput,
} from "./get-user-administration-overview.contracts.js";

export class GetUserAdministrationOverviewUseCase implements GetUserAdministrationOverview {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(private readonly users: UserRepository) {
    this.authorizer = new AdministratorAuthorizer(users);
  }

  async execute(
    input: GetUserAdministrationOverviewInput,
  ): Promise<GetUserAdministrationOverviewOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    return {
      success: true,
      value: await this.users.getAdministrationOverview(),
    };
  }
}
