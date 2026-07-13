// @file bounded-contexts/identity/application/ports/email-verification-rate-limit.port.ts

export abstract class EmailVerificationRateLimitPort {
  abstract canSend(userId: string): Promise<boolean>;
  abstract registerSend(userId: string): Promise<void>;
}
