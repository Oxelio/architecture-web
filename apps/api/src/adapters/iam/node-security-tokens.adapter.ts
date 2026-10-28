import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { SecurityTokens } from "@architecture/iam/application";
export class NodeSecurityTokensAdapter implements SecurityTokens {
  generate() {
    return randomBytes(32).toString("base64url");
  }
  identifier() {
    return randomUUID();
  }
  hash(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}
