import type { Result, ValueOf } from "@architecture/foundation";

import type { RecentAuthenticationError } from "#authentication/reauthentication.contracts";

export const BeginMfaEnrollmentErrors = {
  unavailable: { code: "mfa.unavailable" },
  notFound: { code: "user.not_found" },
  alreadyEnabled: { code: "mfa.already_enabled" },
} as const;

export interface BeginMfaEnrollmentInput {
  userId: string;
  sessionId: string;
  password: string;
}

export type BeginMfaEnrollmentError =
  ValueOf<typeof BeginMfaEnrollmentErrors> | RecentAuthenticationError;

export type BeginMfaEnrollmentOutput = Result<
  {
    secret: string;
    otpauthUri: string;
    qrCodeDataUrl: string;
    expiresAt: Date;
  },
  BeginMfaEnrollmentError
>;

export interface BeginMfaEnrollment {
  execute(input: BeginMfaEnrollmentInput): Promise<BeginMfaEnrollmentOutput>;
}
