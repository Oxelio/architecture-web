// @file foundation/src/domain/identifier.ts

import { ValueObject } from "./value-object.js";

export class Identifier extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }
}
