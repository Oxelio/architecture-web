// @file bounded-contexts/identity/application/use-cases/resolve-session/resolve-session.codes.ts

export const ResolveSessionErrorCodes = {
  unauthorized: {
    code: "session.unauthorized",
  },
} as const;
