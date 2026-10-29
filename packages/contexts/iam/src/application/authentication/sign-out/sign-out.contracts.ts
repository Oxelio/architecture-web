import type { Result, ValueOf } from "@architecture/foundation";

export const SignOutErrors = {
  invalidSessionId: {
    code: "session.invalid_id",
  },
} as const;

export interface SignOutInput {
  sessionId: string;
}

export type SignOutError = ValueOf<typeof SignOutErrors>;

export type SignOutOutput = Result<void, SignOutError>;

export interface SignOut {
  execute(command: SignOutInput): Promise<SignOutOutput>;
}
