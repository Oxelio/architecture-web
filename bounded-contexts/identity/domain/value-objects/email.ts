import { ValueObject } from "@architecture/foundation";

export class Email extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static of(value: string): Email {
    return new Email({
      value: value.toLowerCase(),
    });
  }
}
