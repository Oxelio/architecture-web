// @file bounded-contexts/identity/application/use-cases/change-password.use-case.ts

import type { UserPort } from "#application/ports/user.port";
import type { PasswordHasherPort } from "#application/ports/password-hasher.port";
import { Result, type ErrorOf } from "@architecture/foundation";
import {
  PasswordPlainValueObject,
  type PlainPasswordError,
} from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ChangePasswordInput {
  userId: string;
  password: string;
}

const ChangePasswordErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export type ChangePasswordError =
  | PlainPasswordError
  | ErrorOf<typeof ChangePasswordErrors>;

export type ChangePasswordResult = Result<void, ChangePasswordError>;

export class ChangePasswordUseCase {
  constructor(
    private readonly userPort: UserPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(payload: ChangePasswordInput): Promise<ChangePasswordResult> {
    const userId = UserIdentifierValueObject.create(payload.userId);
    if (!userId.success) {
      return Result.failure(ChangePasswordErrors.invalidId);
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(ChangePasswordErrors.notFound);
    }

    const password = PasswordPlainValueObject.create(payload.password);
    if (!password.success) {
      return Result.failure(password.error);
    }

    const hashed = await this.passwordHasher.hash(password.value);

    user.changePassword(hashed);
    await this.userPort.save(user);

    return Result.ok();
  }
}
