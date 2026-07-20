// @file bounded-contexts/identity/application/use-cases/resolve-session/resolve-session.codes.ts
const ResolveSessionSuccessCodes = {
  resolved: {
    code: "session.resolved",
  },
} as const;

const ResolveSessionErrorCodes = {
  unauthorized: {
    code: "session.unauthorized",
  },
} as const;

export { ResolveSessionErrorCodes, ResolveSessionSuccessCodes };
