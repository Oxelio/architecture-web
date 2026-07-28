// @file bounded-contexts/iam/domain/value-objects/status.value-object.ts

import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const StatusErrors = {
  empty: {
    code: "status.empty",
  },
  invalid: (value: string) => ({
    code: "status.invalid",
    value,
  }),
} as const;

export type StatusError = ValueOf<typeof StatusErrors>;

type UserStatusType = "active" | "suspended";

interface StatusProperties {
  readonly value: UserStatusType;
}

export class StatusValueObject extends ValueObject<StatusProperties> {
  public get value(): UserStatusType {
    return this.properties.value;
  }

  public static active(): StatusValueObject {
    return new StatusValueObject({ value: "active" });
  }

  public static suspended(): StatusValueObject {
    return new StatusValueObject({ value: "suspended" });
  }

  public static create(value: string): Result<StatusValueObject, StatusError> {
    if (!value) {
      return Result.failure(StatusErrors.empty);
    }

    if (!["active", "suspended"].includes(value)) {
      return Result.failure(StatusErrors.invalid(value));
    }

    return Result.success(
      new StatusValueObject({ value: value as UserStatusType }),
    );
  }

  public isActive(): boolean {
    return this.properties.value === "active";
  }

  public isSuspended(): boolean {
    return this.properties.value === "suspended";
  }
}
