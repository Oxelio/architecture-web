import { ValueObject } from "@architecture/foundation";

export class PasswordPlainValueObject extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static create(password: string): PasswordPlainValueObject {
    return new PasswordPlainValueObject({ value: password });
  }
}
