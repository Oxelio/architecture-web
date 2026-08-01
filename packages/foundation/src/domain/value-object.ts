// @file foundation/src/domain/value-object.ts

import equal from "fast-deep-equal";

export abstract class ValueObject<T extends object> {
  protected readonly properties: Readonly<T>;

  protected constructor(properties: T) {
    this.properties = { ...properties };
  }

  equals(valueObject: ValueObject<T>): boolean {
    return equal(this.properties, valueObject.properties);
  }
}
