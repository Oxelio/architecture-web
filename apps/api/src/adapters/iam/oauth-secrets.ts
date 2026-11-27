import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export class OAuthSecrets {
  constructor(
    private readonly artifactKeys: readonly [Buffer, ...Buffer[]],
    private readonly bindingKeys: readonly [Buffer, ...Buffer[]],
  ) {}

  lookup(purpose: string, value: string) {
    return this.artifactKeys.map((key) => this.digest(key, purpose, value));
  }

  index(purpose: string, value: string) {
    return this.digest(this.artifactKeys[0], purpose, value);
  }

  bind(sessionId: string) {
    return this.digest(this.bindingKeys[0], "session binding", sessionId);
  }

  matches(binding: string | null, sessionId: string) {
    if (!binding) {
      return false;
    }
    const expected = Buffer.from(binding, "hex");
    return this.bindingKeys.some((key) => {
      const supplied = Buffer.from(
        this.digest(key, "session binding", sessionId),
        "hex",
      );
      return (
        expected.length === supplied.length &&
        timingSafeEqual(expected, supplied)
      );
    });
  }

  seal(value: unknown, artifactId: string) {
    const nonce = randomBytes(12);
    const key = this.payloadKey(this.artifactKeys[0]);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(artifactId));
    const message = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([nonce, cipher.getAuthTag(), message]);
  }

  open<T>(data: Buffer, artifactId: string): T {
    for (const rootKey of this.artifactKeys) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.payloadKey(rootKey),
        data.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(artifactId));
      decipher.setAuthTag(data.subarray(12, 28));
      let decoded: string;
      try {
        decoded = Buffer.concat([
          decipher.update(data.subarray(28)),
          decipher.final(),
        ]).toString();
      } catch {
        continue;
      }
      return JSON.parse(decoded) as T;
    }
    throw new Error("OAuth artifact cannot be restored");
  }

  private digest(key: Buffer, purpose: string, value: string) {
    return createHmac("sha256", key)
      .update(purpose)
      .update("\0")
      .update(value)
      .digest("hex");
  }

  private payloadKey(key: Buffer) {
    return createHmac("sha256", key)
      .update("oauth artifact encryption v1")
      .digest();
  }
}
