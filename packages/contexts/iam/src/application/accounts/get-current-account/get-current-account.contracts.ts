import type { Result, ValueOf } from "@architecture/foundation";

export const GetCurrentAccountErrors = {
  invalidId: {
    code: "user.invalid_id",
  },

  notFound: {
    code: "user.not_found",
  },
} as const;

export type GetCurrentAccountError = ValueOf<typeof GetCurrentAccountErrors>;

export interface GetCurrentAccountInput {
  readonly actorUserId: string;
}

export interface CurrentAccount {
  userId: string;
  loginIdentifiers: readonly AccountLoginIdentifier[];
  email: string | null;
  isEmailVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface AccountLoginIdentifier {
  readonly kind: "username" | "email";
  readonly value: string;
  readonly verificationStatus: "not_required" | "pending" | "verified";
}

export type GetCurrentAccountOutput = Result<
  CurrentAccount,
  GetCurrentAccountError
>;

export interface GetCurrentAccount {
  execute(command: GetCurrentAccountInput): Promise<GetCurrentAccountOutput>;
}
