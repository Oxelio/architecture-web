export interface RecoveryToken {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly invalidatedAt: Date | null;
}
export function isRecoveryTokenUsable(
  token: RecoveryToken,
  now: Date,
): boolean {
  return !token.consumedAt && !token.invalidatedAt && token.expiresAt > now;
}
