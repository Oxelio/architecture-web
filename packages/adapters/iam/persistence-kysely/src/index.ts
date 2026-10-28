// @file infrastructure/iam/persitence/kysely/src/index.ts

export { KyselyAccountDeletionAdapter } from "./adapters/kysely-account-deletion.adapter.js";
export { KyselyAccountExportAdapter } from "./adapters/kysely-account-export.adapter.js";
export { KyselyEmailVerificationAdapter } from "./adapters/kysely-email-verification.adapter.js";
export { KyselyIamUnitOfWorkAdapter } from "./adapters/kysely-iam-unit-of-work.adapter.js";
export { KyselyLoginIdentityAdapter } from "./adapters/kysely-login-identity.adapter.js";
export { KyselyMfaAdapter } from "./adapters/kysely-mfa.adapter.js";
export { KyselyPasswordAuthenticatorAdapter } from "./adapters/kysely-password-authenticator.adapter.js";
export { KyselyPasswordRecoveryAdapter } from "./adapters/kysely-password-recovery.adapter.js";
export { KyselySecurityConfigurationAdapter } from "./adapters/kysely-security-configuration.adapter.js";
export { KyselyUserAdapter } from "./adapters/kysely-user.adapter.js";
export { iamUserMigrations } from "./persistence/migrations/001_create_iam_users.js";
export { iamEmailVerificationMigrations } from "./persistence/migrations/002_create_iam_email_verifications.js";
export { iamSecurityMigrations } from "./persistence/migrations/003_create_iam_security.js";
export { iamAggregateConsistencyMigrations } from "./persistence/migrations/004_add_iam_aggregate_consistency.js";
export { iamAuthenticationMigrations } from "./persistence/migrations/005_extract_iam_authentication.js";
export { iamSecurityInvariantMigrations } from "./persistence/migrations/006_enforce_iam_security_invariants.js";
export { iamAuthenticationProofMigrations } from "./persistence/migrations/007_bind_authentication_proofs.js";
export { iamConfigurationVersionMigrations } from "./persistence/migrations/008_version_configuration.js";
export type { IamDatabase } from "./persistence/schema.js";
