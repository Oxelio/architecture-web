import { ValueObject, Result, type ErrorOf } from "@architecture/foundation";

const StatusErrors = {
  empty: {
    kind: "status.empty",
  },
  invalid: (value: string) => ({
    kind: "status.invalid",
    value,
  }),
} as const;

export type StatusError = ErrorOf<typeof StatusErrors>;

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

    if (!["active", "suspended", "pending"].includes(value)) {
      return Result.failure(StatusErrors.invalid(value));
    }

    return Result.ok(new StatusValueObject({ value: value as UserStatusType }));
  }

  public isActive(): boolean {
    return this.properties.value === "active";
  }

  public isSuspended(): boolean {
    return this.properties.value === "suspended";
  }
}
