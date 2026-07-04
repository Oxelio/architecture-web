import type { UserPort } from "#application/ports/user.port";
import type { PasswordHasherPort } from "#application/ports/password-hasher.port";
import { Result } from "@architecture/foundation";
import {
  PasswordPlainValueObject,
  type PlainPasswordError,
} from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ChangePasswordInput {
  userId: string;
  password: string;
}

export type ChangePasswordError = PlainPasswordError | { kind: "not_found" };

export type ChangePasswordResult = Result<{}, ChangePasswordError>;

export class ChangePasswordUseCase {
  constructor(
    private readonly userPort: UserPort,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(command: ChangePasswordInput): Promise<ChangePasswordResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) return Result.failure({ kind: "not_found" });

    const password = PasswordPlainValueObject.create(command.password);
    if (!password.success) return Result.failure(password.error);

    const user = await this.userPort.findById(userId.value);
    if (!user) return Result.failure({ kind: "not_found" });

    const hashed = await this.passwordHasher.hash(password.value);

    user.changePassword(hashed);
    await this.userPort.save(user);

    return Result.ok({});
  }
}
