// @file bounded-contexts/identity/application/use-cases/activate-user/activate-user.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ActivateUserErrorsCodes } from "./activate-user.codes.js";
import type {
  ActivateUser,
  ActivateUserInput,
  ActivateUserOutput,
} from "./activate-user.contracts.js";

export class ActivateUserUseCase implements ActivateUser {
  constructor(private readonly userPort: UserRepository) {}

  async execute(command: ActivateUserInput): Promise<ActivateUserOutput> {
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
