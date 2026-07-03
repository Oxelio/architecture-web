import { ValueObject, Result } from "@architecture/foundation";

type StatusError =
  | { readonly kind: "status.empty" }
  | { readonly kind: "status.invalid"; readonly value: string };

const StatusErrorFactory = {
  empty: (): StatusError => ({
    kind: "status.empty",
  }),

  invalid: (value: string): StatusError => ({
    kind: "status.invalid",
    value,
  }),
} as const;

type UserStatusType = "active" | "suspended" | "pending";

interface StatusProperties {
  readonly value: UserStatusType;
}

export class StatusValueObject extends ValueObject<StatusProperties> {
  static active(): StatusValueObject {
    return new StatusValueObject({ value: "active" });
  }

  static suspended(): StatusValueObject {
    return new StatusValueObject({ value: "suspended" });
  }

  static pending(): StatusValueObject {
    return new StatusValueObject({ value: "pending" });
  }

  static create(value: string): Result<StatusValueObject, StatusError> {
    if (!value) {
      return Result.failure(StatusErrorFactory.empty());
    }

    if (!["active", "suspended", "pending"].includes(value)) {
      return Result.failure(StatusErrorFactory.invalid(value));
    }

    return Result.ok(new StatusValueObject({ value: value as UserStatusType }));
  }

  get value(): UserStatusType {
    return this.properties.value;
  }

  isActive(): boolean {
    return this.properties.value === "active";
  }

  isSuspended(): boolean {
    return this.properties.value === "suspended";
  }

  isPending(): boolean {
    return this.properties.value === "pending";
  }
}
