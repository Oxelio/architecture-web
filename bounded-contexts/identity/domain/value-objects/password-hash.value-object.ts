import { Result, ValueObject } from "@architecture/foundation";

interface HashedPasswordError {
  readonly kind: "hashed_password.empty";
}

const HashedPasswordError = {
  empty: (): HashedPasswordError => ({ kind: "hashed_password.empty" }),
} as const;

export class PasswordHashValueObject extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static create(
    value: string,
  ): Result<PasswordHashValueObject, HashedPasswordError> {
    if (!value) {
      return Result.failure(HashedPasswordError.empty());
    }
    return Result.ok(new PasswordHashValueObject({ value }));
  }
}
