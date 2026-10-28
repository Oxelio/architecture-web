export interface MfaCredential {
  readonly userId: string;
  readonly sealedSecret: string;
  readonly enrollmentExpiresAt: Date | null;
  readonly enabledAt: Date | null;
  readonly lastCounter: number | null;
}
export interface MfaChallenge {
  readonly id: string;
  readonly userId: string;
  readonly purpose: "signin" | "enrollment_confirmation";
  readonly attempts: number;
  readonly maximumAttempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}
export function isMfaChallengeUsable(
  challenge: MfaChallenge,
  now: Date,
): boolean {
  return (
    !challenge.consumedAt &&
    challenge.expiresAt > now &&
    challenge.attempts < challenge.maximumAttempts
  );
}
export function isMfaEnrollmentUsable(
  credential: MfaCredential,
  now: Date,
): boolean {
  return (
    !credential.enabledAt &&
    credential.enrollmentExpiresAt !== null &&
    credential.enrollmentExpiresAt > now
  );
}
