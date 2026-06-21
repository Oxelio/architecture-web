import { ValueObject } from "@architecture/foundation";

export class PasswordHash extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static create(value: string): PasswordHash {
    return new PasswordHash({ value });
  }

  static of(value: string): PasswordHash {
    return new PasswordHash({ value });
  }
}
