import { v7 as uuid } from "uuid";
import { Identifier } from "@architecture/foundation";

export class UserIdentifier extends Identifier {
  static generate(): UserIdentifier {
    return new UserIdentifier({
      value: uuid(),
    });
  }

  static of(value: string): UserIdentifier {
    return new UserIdentifier({ value });
  }
}
