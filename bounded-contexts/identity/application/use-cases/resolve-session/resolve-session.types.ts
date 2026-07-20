// @file bounded-contexts/identity/application/use-cases/resolve-session/resolve-session.types.ts
import type { Result, ValueOf } from "@architecture/foundation";

import type {
  ResolveSessionErrorCodes,
  ResolveSessionSuccessCodes,
} from "./resolve-session.codes.js";

export interface ResolveSessionInput {
  sessionId: string;
}

export type ResolveSessionSuccess = ValueOf<typeof ResolveSessionSuccessCodes>;

export type ResolveSessionError = ValueOf<typeof ResolveSessionErrorCodes>;

export interface SessionResolution {
  userId: string;
  sessionId: string;
}

export type ResolveSessionOutput = Result<
  {
    code: ResolveSessionSuccess["code"];
    data: SessionResolution;
  },
  ResolveSessionError
>;
