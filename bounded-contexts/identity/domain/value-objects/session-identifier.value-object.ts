import { v7 as uuid } from "uuid";
import { Identifier } from "@architecture/foundation";

export class SessionIdentifierValueObject extends Identifier {
  static generate(): SessionIdentifierValueObject {
    return new SessionIdentifierValueObject({
      value: uuid(),
    });
  }

  static of(value: string): SessionIdentifierValueObject {
    return new SessionIdentifierValueObject({ value });
  }
}
