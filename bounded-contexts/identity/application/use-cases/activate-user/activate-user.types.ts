// @file bounded-contexts/identity/application/use-cases/activate-user/activate-user.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type {
  ActivateUserErrorsCodes,
  ActivateUserSuccessCodes,
} from "./activate-user.codes.js";

export interface ActivateUserInput {
  readonly userId: string;
}

export type ActivateUserSuccess = ValueOf<typeof ActivateUserSuccessCodes>;
export type ActivateUserError = ValueOf<typeof ActivateUserErrorsCodes>;

export type ActivateUserOutput = Result<ActivateUserSuccess, ActivateUserError>;
