import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { MfaCryptography } from "@architecture/iam/application";
import QRCode from "qrcode";
export class NodeMfaCryptographyAdapter implements MfaCryptography {
  private readonly key: Buffer;
  constructor(encryptionKey: string) {
    this.key = createHash("sha256").update(encryptionKey, "utf8").digest();
  }
  generateSecret() {
    return base32Encode(randomBytes(20));
  }
  generateBackupCodes() {
    return Array.from({ length: 10 }, () => {
      const value = randomBytes(8).toString("hex").toUpperCase();
      return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
    });
  }
  seal(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
  }
  open(value: string) {
    const [iv, tag, encrypted] = value.split(".");
    if (!iv || !tag || !encrypted) {
      throw new Error("Invalid sealed MFA secret");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
  verifyTotp(secret: string, code: string) {
    return verifyTotp(secret, code);
  }
  qrCode(uri: string) {
    return QRCode.toDataURL(uri, { errorCorrectionLevel: "M" });
  }
}
function base32Encode(input: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of input) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output +=
      alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let end = input.length;
  while (end > 0 && input[end - 1] === "=") {
    end -= 1;
  }
  for (const character of input.slice(0, end).toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) {
      throw new Error("Invalid MFA secret encoding");
    }
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function verifyTotp(secret: string, code: string): number | null {
  const current = Math.floor(Date.now() / 30_000);
  for (const counter of [current - 1, current, current + 1]) {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", base32Decode(secret))
      .update(counterBuffer)
      .digest();
    const offset = (digest.at(-1) ?? 0) & 0x0f;
    const binary =
      ((digest[offset] ?? 0) & 0x7f) * 0x1000000 +
      (digest[offset + 1] ?? 0) * 0x10000 +
      (digest[offset + 2] ?? 0) * 0x100 +
      (digest[offset + 3] ?? 0);
    const expected = String(binary % 1_000_000).padStart(6, "0");
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(code);
    if (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return counter;
    }
  }
  return null;
}
