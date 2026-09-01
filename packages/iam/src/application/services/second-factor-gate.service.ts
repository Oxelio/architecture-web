export interface SecondFactorChallenge {
  readonly mfaRequired: true;
  readonly userId: string;
  readonly sessionId: null;
  readonly sessionExpiresAt: null;
  readonly challengeId: string;
  readonly expiresAt: Date;
}

export abstract class SecondFactorGate {
  abstract beginSignIn(userId: string): Promise<SecondFactorChallenge | null>;
}
