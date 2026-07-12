import type { UserPort } from "#application/ports/user.port";
import { Result } from "@architecture/foundation";
import {
  EmailValueObject,
  type EmailError,
} from "#value-objects/email.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface ChangeEmailInput {
  userId: string;
  email: string;
}

export type ChangeEmailError =
  | EmailError
  | { code: "not_found" }
  | { code: "user.already_exists" };

export type ChangeEmailResult = Result<void, ChangeEmailError>;

export class ChangeEmailUseCase {
  constructor(private readonly userPort: UserPort) {}

  async execute(command: ChangeEmailInput): Promise<ChangeEmailResult> {
    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure({ code: "not_found" });
    }

    const email = EmailValueObject.create(command.email);
    if (!email.success) {
      return Result.failure(email.error);
    }

    // check existing email
    const existing = await this.userPort.findByEmail(email.value);
    if (existing && existing.identifier.value !== userId.value.value) {
      return Result.failure({ code: "user.already_exists" });
    }

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure({ code: "not_found" });
    }

    user.changeEmail(email.value);
    await this.userPort.save(user);

    return Result.ok();
  }
}
