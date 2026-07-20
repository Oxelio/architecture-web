// @file bounded-contexts/identity/application/use-cases/suspend-user/suspend-user.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type {
  SuspendUserErrorCodes,
  SuspendUserSuccessCodes,
} from "./suspend-user.codes.js";

export interface SuspendUserInput {
  userId: string;
}

export type SuspendUserSuccess = ValueOf<typeof SuspendUserSuccessCodes>;

export type SuspendUserError = ValueOf<typeof SuspendUserErrorCodes>;

export type SuspendUserOutput = Result<SuspendUserSuccess, SuspendUserError>;
