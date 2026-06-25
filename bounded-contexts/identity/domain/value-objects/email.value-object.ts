import { ValueObject } from "@architecture/foundation";

export class EmailValueObject extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static of(value: string): EmailValueObject {
    return new EmailValueObject({
      value: value.toLowerCase(),
    });
  }
}
