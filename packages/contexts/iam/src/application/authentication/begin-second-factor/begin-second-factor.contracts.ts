import type { Result, ValueOf } from "@architecture/foundation";

export const BeginSecondFactorErrors = {
  invalidChallenge: { code: "mfa.invalid_challenge" },
  enrollmentRequired: { code: "mfa.enrollment_required" },
} as const;

export interface BeginSecondFactorInput {
  userId: string;
  expectedSessionVersion: number;
  policy?: import("#domain/security-policy").SecurityPolicy["authentication"];
}

export type BeginSecondFactorError = ValueOf<typeof BeginSecondFactorErrors>;

export type BeginSecondFactorOutput = Result<
  | import("#authentication/sign-in/sign-in.contracts").SecondFactorChallenge
  | null,
  BeginSecondFactorError
>;

export interface BeginSecondFactor {
  execute(input: BeginSecondFactorInput): Promise<BeginSecondFactorOutput>;
}
