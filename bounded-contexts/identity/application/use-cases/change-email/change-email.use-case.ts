// @file bounded-contexts/identity/application/use-cases/change-email/change-email.use-case.ts

import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ChangeEmailErrorsCodes } from "./change-email.codes.js";
import type {
  ChangeEmail,
  ChangeEmailInput,
  ChangeEmailOutput,
} from "./change-email.contracts.js";

export class ChangeEmailUseCase implements ChangeEmail {
  constructor(private readonly userPort: UserRepository) {}

  async execute(command: ChangeEmailInput): Promise<ChangeEmailOutput> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ChangeEmailErrorsCodes.invalidId);
    }

    const email = EmailValueObject.create(command.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    // check existing email
    const existing = await this.userPort.findByEmail(email.value);
    if (existing && existing.identifier.value !== userId.value.value) {
      return Result.failure(ChangeEmailErrorsCodes.userAlreadyExists);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangeEmailErrorsCodes.notFound);
    }

    user.changeEmail(email.value);
    await this.userPort.save(user);

    return Result.success(undefined);
  }
}
