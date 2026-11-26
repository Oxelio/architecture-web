import type { Result } from "@architecture/foundation";

export interface CriticalConfigurationSecurityState {
  readonly comparison: string;
  readonly sessionVersion: number;
  readonly mfaEnabled: boolean;
}

export type CriticalConfigurationRefusal =
  "session_invalid" | "confirmation_refused" | "unauthorized";

export type CriticalConfigurationAdmissionError =
  CriticalConfigurationRefusal | "version_conflict" | "attempts_exhausted";

/** Serializes admission and final account-state checks with IAM security writers. */
export interface CriticalConfigurationConfirmationStore {
  admit(
    input: { actorId: string; expectedVersion: number },
    checkEligibility: (
      state: CriticalConfigurationSecurityState,
    ) => CriticalConfigurationRefusal | undefined,
  ): Promise<
    Result<
      CriticalConfigurationSecurityState,
      CriticalConfigurationAdmissionError
    >
  >;

  authorize(
    actorId: string,
    expected: CriticalConfigurationSecurityState,
    checkOriginatingSession: () => Promise<
      CriticalConfigurationRefusal | undefined
    >,
  ): Promise<CriticalConfigurationRefusal | undefined>;
}
