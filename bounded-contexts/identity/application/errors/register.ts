import type { Result } from "@architecture/foundation";

export interface RegisterError {
  code: "USER_ALREADY_EXISTS";
}

export type RegisterUserResponse = {
  userId: string;
};

export type RegisterResult = Result<RegisterUserResponse, RegisterError>;
