import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const StatusErrors = {
  empty: {
    code: "status.empty",
  },
  invalid: (value: string) =>
    ({
      code: "status.invalid",
      value,
    }) as const,
} as const;

export type StatusError = ValueOf<typeof StatusErrors>;

type UserStatusType = "active" | "suspended" | "pending_deletion";

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

  public static pendingDeletion(): StatusValueObject {
    return new StatusValueObject({ value: "pending_deletion" });
  }

  public static create(value: string): Result<StatusValueObject, StatusError> {
    if (!value) {
      return Result.failure(StatusErrors.empty);
    }

    if (!["active", "suspended", "pending_deletion"].includes(value)) {
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

  public isPendingDeletion(): boolean {
    return this.properties.value === "pending_deletion";
  }
}
