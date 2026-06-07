import { v7 as uuid } from "uuid";
import { Identifier } from "@architecture/foundation";

export class SessionIdentifier extends Identifier {
  static generate(): SessionIdentifier {
    return new SessionIdentifier({
      value: uuid(),
    });
  }

  static of(value: string): SessionIdentifier {
    return new SessionIdentifier({ value });
  }
}
