// @file bounded-contexts/iam/application/use-cases/get-current-account/get-current-account.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { GetCurrentAccountErrorCodes } from "./get-current-account.codes.js";

export type GetCurrentAccountError = ValueOf<
  typeof GetCurrentAccountErrorCodes
>;

export interface GetCurrentAccountInput {
  readonly actorUserId: string;
}

export interface CurrentAccount {
  userId: string;
  email: string;
  isEmailVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export type GetCurrentAccountOutput = Result<
  CurrentAccount,
  GetCurrentAccountError
>;

export interface GetCurrentAccount {
  execute(command: GetCurrentAccountInput): Promise<GetCurrentAccountOutput>;
}
