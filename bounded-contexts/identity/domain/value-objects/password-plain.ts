import { ValueObject } from "@architecture/foundation";

export class PasswordPlain extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static create(password: string): PasswordPlain {
    return new PasswordPlain({ value: password });
  }
}
