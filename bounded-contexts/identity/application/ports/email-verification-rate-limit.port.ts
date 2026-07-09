export abstract class EmailVerificationRateLimitPort {
  abstract canSend(userId: string): Promise<boolean>;
  abstract registerSend(userId: string): Promise<void>;
}
