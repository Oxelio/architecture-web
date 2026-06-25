import { v7 as uuid } from "uuid";
import { Identifier } from "@architecture/foundation";

export class UserIdentifierValueObject extends Identifier {
  static generate(): UserIdentifierValueObject {
    return new UserIdentifierValueObject({
      value: uuid(),
    });
  }

  static of(value: string): UserIdentifierValueObject {
    return new UserIdentifierValueObject({ value });
  }
}
