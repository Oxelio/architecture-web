// @file bounded-contexts/identity/application/use-cases/change-email.use-case.ts

import { type ErrorOf, Result } from "@architecture/foundation";

import type { UserPort } from "#application/ports/user.port";
import {
  type EmailError,
  EmailValueObject,
} from "#value-objects/email.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ChangeEmailInput {
  userId: string;
  email: string;
}

const ChangeEmailErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },

  userAlreadyExists: {
    code: "user.already_exists",
  },
} as const;

export type ChangeEmailError = EmailError | ErrorOf<typeof ChangeEmailErrors>;

export type ChangeEmailResult = Result<void, ChangeEmailError>;

export class ChangeEmailUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: ChangeEmailInput): Promise<ChangeEmailResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ChangeEmailErrors.invalidId);
    }

    const email = EmailValueObject.create(command.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    // check existing email
    const existing = await this.userPort.findByEmail(email.value);
    if (existing && existing.identifier.value !== userId.value.value) {
      return Result.failure(ChangeEmailErrors.userAlreadyExists);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangeEmailErrors.notFound);
    }

    user.changeEmail(email.value);
    await this.userPort.save(user);

    return Result.ok();
  }
}
