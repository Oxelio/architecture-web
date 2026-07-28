// @file bounded-contexts/iam/application/use-cases/activate-user/activate-user.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { AdministratorAuthorizer } from "#services/administrator-authorizer.service";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ActivateUserErrorsCodes } from "./activate-user.codes.js";
import type {
  ActivateUser,
  ActivateUserInput,
  ActivateUserOutput,
} from "./activate-user.contracts.js";

export class ActivateUserUseCase implements ActivateUser {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(private readonly userPort: UserRepository) {
    this.authorizer = new AdministratorAuthorizer(userPort);
  }

  async execute(command: ActivateUserInput): Promise<ActivateUserOutput> {
    const authorization = await this.authorizer.authorize(command.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ActivateUserErrorsCodes.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ActivateUserErrorsCodes.notFound);
    }

    user.activate();

    await this.userPort.save(user);

    return Result.success(undefined);
  }
}
