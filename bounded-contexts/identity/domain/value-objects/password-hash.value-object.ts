import { ValueObject } from "@architecture/foundation";

export class PasswordHashValueObject extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static create(value: string): PasswordHashValueObject {
    return new PasswordHashValueObject({ value });
  }

  static of(value: string): PasswordHashValueObject {
    return new PasswordHashValueObject({ value });
  }
}
