// @file infrastructure/iam/persitence/kysely/src/index.ts

export { KyselyEmailVerificationAdapter } from "./adapters/kysely-email-verification.adapter.js";
export { KyselyIamUnitOfWorkAdapter } from "./adapters/kysely-iam-unit-of-work.adapter.js";
export { KyselyLoginIdentityAdapter } from "./adapters/kysely-login-identity.adapter.js";
export { KyselyPasswordAuthenticatorAdapter } from "./adapters/kysely-password-authenticator.adapter.js";
export { KyselyUserAdapter } from "./adapters/kysely-user.adapter.js";
export { iamUserMigrations } from "./persistence/migrations/001_create_iam_users.js";
export { iamEmailVerificationMigrations } from "./persistence/migrations/002_create_iam_email_verifications.js";
export { iamSecurityMigrations } from "./persistence/migrations/003_create_iam_security.js";
export { iamAggregateConsistencyMigrations } from "./persistence/migrations/004_add_iam_aggregate_consistency.js";
export { iamAuthenticationMigrations } from "./persistence/migrations/005_extract_iam_authentication.js";
export type { IamDatabase } from "./persistence/schema.js";
