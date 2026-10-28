import type { RecoveryToken } from "#domain/recovery-token";
import type { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import type { UserEntity } from "#entities/user.entity";
import type { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import type { UserRepository } from "#repositories/user.repository";
export interface RecoveryCommit {
  readonly user: UserEntity;
  readonly authenticator: PasswordAuthenticatorEntity;
  readonly users: UserRepository;
  readonly passwordAuthenticators: PasswordAuthenticatorRepository;
  consume(): Promise<void>;
}
export interface PasswordRecoveryStore {
  find(tokenHash: string): Promise<RecoveryToken | null>;
  issue(input: {
    id: string;
    userId: string;
    tokenHash: string;
    emailFingerprint: string;
    expiresAt: Date;
    now: Date;
    maximumPerHour: number;
  }): Promise<boolean>;
  withUsableToken<T>(
    tokenHash: string,
    now: Date,
    work: (commit: RecoveryCommit) => Promise<T>,
  ): Promise<T | null>;
}
