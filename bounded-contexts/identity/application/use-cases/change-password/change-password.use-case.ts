// @file bounded-contexts/identity/application/use-cases/change-password/change-password.use-case.ts

import { Result } from "@architecture/foundation";

import type { PasswordHasherPort } from "#application/ports/password-hasher.port";
import type { UserPort } from "#application/ports/user.port";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  ChangePasswordErrorsCodes,
  ChangePasswordSuccessCodes,
} from "./change-password.codes.js";
import type {
  ChangePasswordInput,
  ChangePasswordOutput,
} from "./change-password.types.js";

export class ChangePasswordUseCase {
  constructor(
    private readonly userPort: UserPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(payload: ChangePasswordInput): Promise<ChangePasswordOutput> {
    const userId = UserIdentifierValueObject.create(payload.userId);
    if (!userId.success) {
      return Result.failure(ChangePasswordErrorsCodes.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangePasswordErrorsCodes.notFound);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(password.error);
    }

    const hashed = await this.passwordHasher.hash(password.value);

    user.changePassword(hashed);
    await this.userPort.save(user);

    return Result.success(ChangePasswordSuccessCodes.changed);
  }
}
