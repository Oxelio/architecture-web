// @file bounded-contexts/identity/application/use-cases/suspend-user/suspend-user.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type { SuspendUserErrorCodes } from "./suspend-user.codes.js";

export type SuspendUserError = ValueOf<typeof SuspendUserErrorCodes>;

export interface SuspendUserInput {
  userId: string;
  actorUserId?: string;
}

export type SuspendUserOutput = Result<undefined, SuspendUserError>;

export interface SuspendUser {
  execute(command: SuspendUserInput): Promise<SuspendUserOutput>;
}
