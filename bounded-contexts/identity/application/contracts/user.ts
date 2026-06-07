import type { User } from "#entities/user";
import type { Email } from "#value-objects/email";

export abstract class UserContract {
  abstract save(user: User): Promise<void>;
  abstract findByEmail(email: Email): Promise<User | null>;
}
