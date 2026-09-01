import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const UserRoleErrors = {
  empty: { code: "user_role.empty" },
  invalid: (value: string) => ({ code: "user_role.invalid", value }),
} as const;

export type UserRoleError = ValueOf<typeof UserRoleErrors>;

export type UserRole = "user" | "admin";

interface UserRoleProperties {
  readonly value: UserRole;
}

export class UserRoleValueObject extends ValueObject<UserRoleProperties> {
  public static user(): UserRoleValueObject {
    return new UserRoleValueObject({ value: "user" });
  }

  public static admin(): UserRoleValueObject {
    return new UserRoleValueObject({ value: "admin" });
  }

  public static create(
    value: string,
  ): Result<UserRoleValueObject, UserRoleError> {
    if (!value) {
      return Result.failure(UserRoleErrors.empty);
    }

    if (value !== "user" && value !== "admin") {
      return Result.failure(UserRoleErrors.invalid(value));
    }

    return Result.success(new UserRoleValueObject({ value }));
  }

  public get value(): UserRole {
    return this.properties.value;
  }

  public isAdmin(): boolean {
    return this.value === "admin";
  }
}
