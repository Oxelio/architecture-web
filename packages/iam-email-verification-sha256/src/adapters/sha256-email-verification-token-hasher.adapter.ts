import { createHash } from "node:crypto";

import type { EmailVerificationTokenHasher } from "@architecture/iam/application";
import {
  EmailVerificationTokenHashValueObject,
  type EmailVerificationTokenValueObject,
} from "@architecture/iam/domain";

export class Sha256EmailVerificationTokenHasherAdapter implements EmailVerificationTokenHasher {
  async hash(
    token: EmailVerificationTokenValueObject,
  ): Promise<EmailVerificationTokenHashValueObject> {
    const hash = createHash("sha256").update(token.value).digest("hex");
    const result = EmailVerificationTokenHashValueObject.create(hash);

    if (!result.success) {
      throw new Error("Invalid email verification token hash");
    }

    return result.value;
  }
}
