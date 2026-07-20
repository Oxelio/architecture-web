// @file bounded-contexts/identity/application/use-cases/activate-user/activate-user.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserPort } from "#application/ports/user.port";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  ActivateUserErrorsCodes,
  ActivateUserSuccessCodes,
} from "./activate-user.codes.js";
import type {
  ActivateUserInput,
  ActivateUserOutput,
} from "./activate-user.types.js";

export class ActivateUserUseCase {
  constructor(private readonly userPort: UserPort) {}

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

    return Result.success(ActivateUserSuccessCodes.activated);
  }
}
