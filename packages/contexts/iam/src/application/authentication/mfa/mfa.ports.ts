import type { MfaChallenge, MfaCredential } from "#domain/mfa";
import type { UserEntity } from "#entities/user.entity";
export interface MfaCryptography {
  generateSecret(): string;
  seal(secret: string): string;
  open(sealed: string): string;
  verifyTotp(secret: string, code: string): number | null;
  generateBackupCodes(): readonly string[];
  qrCode(uri: string): Promise<string>;
}
export interface MfaStore {
  credential(userId: string): Promise<MfaCredential | null>;
  remainingBackupCodes(userId: string): Promise<number>;
  beginEnrollment(credential: MfaCredential, now: Date): Promise<boolean>;
  confirmEnrollment(input: {
    userId: string;
    sealedSecret: string;
    counter: number;
    backupHashes: readonly string[];
    confirmationId: string;
    now: Date;
  }): Promise<boolean>;
  activate(input: {
    user: UserEntity;
    confirmationId: string;
    now: Date;
  }): Promise<boolean>;
  findChallenge(id: string): Promise<MfaChallenge | null>;
  beginChallenge(input: {
    id: string;
    userId: string;
    expiresAt: Date;
    maximumAttempts: number;
    userSessionVersion: number;
    now: Date;
  }): Promise<MfaChallenge | null>;
  verify(input: {
    userId: string;
    sealedSecret: string;
    counter: number | null;
    backupHash: string;
    now: Date;
    challengeId?: string;
  }): Promise<"totp" | "backup_code" | null>;
  replaceBackupCodes(
    userId: string,
    hashes: readonly string[],
    now: Date,
  ): Promise<boolean>;
  disable(user: UserEntity): Promise<boolean>;
}
