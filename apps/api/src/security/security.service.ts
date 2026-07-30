import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  AuditApplication,
  type AuditContext,
  type AuditEntry,
  type AuditResult,
} from "@architecture/audit";
import type {
  IamActorRole,
  IamCapability,
  IamPolicyProvider,
  PasswordHasher,
  SecondFactorChallenge,
  SecondFactorGate,
  SessionRepository,
} from "@architecture/iam/application";
import { MAX_ACTIVE_SESSIONS_PER_USER } from "@architecture/iam/application";
import {
  createPasswordPolicy,
  PasswordPlainValueObject,
  SessionEntity,
  SessionIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely } from "kysely";
import QRCode from "qrcode";

import type { AppDatabase } from "#composition-root/database.module";

import {
  DEFAULT_SECURITY_POLICY,
  policyValue,
  SECURITY_CONFIG_CATALOG,
  type SecurityPolicy,
  SecurityPolicySchema,
} from "./security-policy.js";

export type ActorType = "user" | "administrator" | "system" | "anonymous";

export interface SecurityContext extends AuditContext {
  actorType: ActorType;
}

export class SecurityError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}

interface SecurityServiceOptions {
  db: Kysely<AppDatabase>;
  passwordHasher: PasswordHasher;
  sessions: SessionRepository;
  email: NodemailerEmailSenderAdapter;
  encryptionKey: string;
  recoveryUrl: string;
  deletionCancellationUrl: string;
  audit: AuditApplication;
  outbox: OutboxWriter;
}

interface MfaVerification {
  userId: string;
  method: "totp" | "backup_code";
}

const SENSITIVE_KEY = /(password|token|secret|cookie|authorization|code)/i;
const NOTIFIABLE_SECURITY_EVENTS = new Set([
  "account.recovery.completed",
  "account.deletion.requested",
  "account.deletion.cancelled",
  "mfa.activated",
  "mfa.disabled",
  "mfa.backup_codes.regenerated",
  "mfa.backup_code.used",
]);

function toAuditResponse(entry: AuditEntry) {
  return {
    id: entry.id,
    type: entry.type,
    occurred_at: entry.occurredAt,
    result: entry.result,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    subject_id: entry.subjectId,
    correlation_id: entry.correlationId,
    client: entry.client,
    metadata: entry.metadata,
  };
}

export class SecurityService implements SecondFactorGate, IamPolicyProvider {
  private readonly key: Buffer;

  constructor(private readonly options: SecurityServiceOptions) {
    this.key = createHash("sha256")
      .update(options.encryptionKey, "utf8")
      .digest();
  }

  async policy(): Promise<SecurityPolicy> {
    const revision = await this.options.db
      .selectFrom("iam_security_config_revisions")
      .select("values")
      .where("status", "=", "published")
      .orderBy("version", "desc")
      .executeTakeFirst();
    return revision
      ? validatePolicy(revision.values)
      : structuredClone(DEFAULT_SECURITY_POLICY);
  }

  async getPasswordPolicy(role: IamActorRole) {
    const { passwords } = await this.policy();
    const privileged = role === "admin";
    return createPasswordPolicy(
      privileged ? passwords.privilegedLevel : passwords.standardLevel,
      {
        minLength: privileged
          ? passwords.privilegedMinLength
          : passwords.standardMinLength,
        maxLength: passwords.maxLength,
        minimumStrength: privileged
          ? passwords.privilegedMinimumStrength
          : passwords.standardMinimumStrength,
        checkCommonPasswords: passwords.checkCommonPasswords,
        checkCompromisedPasswords: passwords.checkCompromisedPasswords,
        checkUserContext: passwords.checkUserContext,
        rejectCurrentPassword: passwords.rejectCurrentPassword,
        composition: {
          requireUppercase: passwords.requireUppercase,
          requireLowercase: passwords.requireLowercase,
          requireNumber: passwords.requireNumber,
          requireSpecialCharacter: passwords.requireSpecialCharacter,
        },
      },
    );
  }

  async getSessionDurationMinutes(): Promise<number> {
    return (await this.policy()).sessions.durationMinutes;
  }

  async isCapabilityEnabled(capability: IamCapability): Promise<boolean> {
    const policy = await this.policy();
    const values: Record<IamCapability, boolean> = {
      "accounts.publicRegistration": policy.accounts.publicRegistration,
      "accounts.emailVerification": policy.accounts.emailVerification,
      "accounts.emailChange": policy.accounts.emailChange,
      "accounts.export": policy.accounts.export,
      "accounts.deletion": policy.accounts.deletion,
      "authentication.mfa": policy.authentication.mfaAvailable,
      "sessions.userManagement": policy.sessions.userManagement,
      recovery: policy.recovery.enabled,
      "audit.consultation": policy.audit.consultation,
    };
    return values[capability] ?? false;
  }

  async publicCapabilities() {
    const policy = await this.policy();
    return {
      publicRegistration: policy.accounts.publicRegistration,
      emailVerification: policy.accounts.emailVerification,
      emailChange: policy.accounts.emailChange,
      sessionManagement: policy.sessions.userManagement,
      recovery: policy.recovery.enabled,
      mfa: policy.authentication.mfaAvailable,
      accountExport: policy.accounts.export,
      accountDeletion: policy.accounts.deletion,
    };
  }

  async configCenter() {
    const effective = await this.policy();
    const revisions = await this.options.db
      .selectFrom("iam_security_config_revisions")
      .select([
        "id",
        "version",
        "status",
        "created_by",
        "created_at",
        "published_at",
        "previous_revision_id",
      ])
      .orderBy("version", "desc")
      .limit(50)
      .execute();
    return {
      catalog: SECURITY_CONFIG_CATALOG,
      effective,
      revisions,
    };
  }

  async previewPolicy(values: unknown) {
    const proposed = validatePolicy(values);
    const effective = await this.policy();
    const changedKeys = diffKeys(effective, proposed);
    const affectedAdministrators =
      proposed.authentication.mfaRequiredRoles.includes("admin") &&
      !effective.authentication.mfaRequiredRoles.includes("admin")
        ? await this.options.db
            .selectFrom("iam_users")
            .leftJoin(
              "iam_mfa_settings",
              "iam_mfa_settings.user_id",
              "iam_users.id",
            )
            .select(({ fn }) => fn.countAll<number>().as("count"))
            .where("iam_users.role", "=", "admin")
            .where("iam_users.status", "=", "active")
            .where("iam_mfa_settings.enabled_at", "is", null)
            .executeTakeFirstOrThrow()
        : { count: 0 };
    return {
      valid: true,
      changedKeys,
      impact: changedKeys.some((key) =>
        SECURITY_CONFIG_CATALOG.some(
          (option) => option.key === key && option.impact === "critical",
        ),
      )
        ? "critical"
        : "standard",
      affectedAccounts: {
        administratorsRequiringEnrollment: Number(affectedAdministrators.count),
      },
      changes: changedKeys.map((key) => ({
        key,
        before: policyValue(effective, key),
        after: policyValue(proposed, key),
      })),
      warnings: [
        ...(effective.authentication.mfaAvailable &&
        !proposed.authentication.mfaAvailable
          ? [
              "Disabling MFA availability does not erase existing encrypted MFA settings.",
            ]
          : []),
        ...(proposed.audit.retentionDays < effective.audit.retentionDays
          ? ["The next maintenance run may purge older audit events."]
          : []),
      ],
    };
  }

  async publishPolicy(
    actorId: string,
    values: unknown,
    expectedVersion: number,
    justification: string,
    confirmedCritical = false,
  ) {
    const policy = validatePolicy(values);
    const previousPolicy = await this.policy();
    const changedKeys = diffKeys(previousPolicy, policy);
    const critical = changedKeys.some((key) =>
      SECURITY_CONFIG_CATALOG.some(
        (option) => option.key === key && option.impact === "critical",
      ),
    );
    if (!justification.trim()) {
      throw new SecurityError("CONFIG_JUSTIFICATION_REQUIRED");
    }
    if (critical && !confirmedCritical) {
      throw new SecurityError("CONFIG_CRITICAL_CONFIRMATION_REQUIRED", 409);
    }
    const current = await this.options.db
      .selectFrom("iam_security_config_revisions")
      .select(["id", "version"])
      .where("status", "=", "published")
      .orderBy("version", "desc")
      .executeTakeFirst();
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      throw new SecurityError("CONFIG_VERSION_CONFLICT", 409);
    }
    const id = randomUUID();
    const now = new Date();
    await this.options.db.transaction().execute(async (transaction) => {
      if (current) {
        await transaction
          .updateTable("iam_security_config_revisions")
          .set({ status: "superseded" })
          .where("id", "=", current.id)
          .execute();
      }
      await transaction
        .insertInto("iam_security_config_revisions")
        .values({
          id,
          version: currentVersion + 1,
          status: "published",
          values: JSON.stringify(policy),
          created_by: actorId,
          created_at: now,
          published_at: now,
          previous_revision_id: current?.id ?? null,
        })
        .execute();
    });
    await this.audit(
      "security.config.published",
      "success",
      {
        actorType: "administrator",
        actorId,
        subjectId: actorId,
      },
      {
        version: currentVersion + 1,
        changedKeys,
        justification: justification.trim().slice(0, 500),
      },
    );
    return { id, version: currentVersion + 1, effective: policy };
  }

  async rollbackPolicy(actorId: string, revisionId: string) {
    const target = await this.options.db
      .selectFrom("iam_security_config_revisions")
      .select("values")
      .where("id", "=", revisionId)
      .executeTakeFirst();
    if (!target) {
      throw new SecurityError("CONFIG_REVISION_NOT_FOUND", 404);
    }
    const current = await this.options.db
      .selectFrom("iam_security_config_revisions")
      .select("version")
      .where("status", "=", "published")
      .orderBy("version", "desc")
      .executeTakeFirst();
    return this.publishPolicy(
      actorId,
      target.values,
      current?.version ?? 0,
      `Rollback to ${revisionId}`,
      true,
    );
  }

  async requestRecovery(
    email: string,
    context: SecurityContext,
  ): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const fingerprint = this.hash(normalized);
    const policy = await this.policy();
    const originFingerprint = context.ipAddress
      ? this.hash(context.ipAddress)
      : null;
    const originRequests = originFingerprint
      ? await this.options.audit.countRecentByNetworkFingerprint(
          "account.recovery.requested",
          originFingerprint,
          new Date(Date.now() - 60 * 60 * 1000),
        )
      : 0;
    const user = await this.options.db
      .selectFrom("iam_users")
      .select(["id", "email", "status", "is_email_verified"])
      .where("email", "=", normalized)
      .executeTakeFirst();
    const eligible =
      policy.recovery.enabled &&
      user?.is_email_verified === true &&
      originRequests < policy.recovery.requestsPerHour * 4;

    if (eligible && user) {
      const recent = await this.options.db
        .selectFrom("iam_password_recoveries")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("user_id", "=", user.id)
        .where("created_at", ">", new Date(Date.now() - 60 * 60 * 1000))
        .executeTakeFirstOrThrow();
      if (Number(recent.count) < policy.recovery.requestsPerHour) {
        const token = this.token();
        const now = new Date();
        await this.options.db.transaction().execute(async (transaction) => {
          await transaction
            .updateTable("iam_password_recoveries")
            .set({ invalidated_at: now })
            .where("user_id", "=", user.id)
            .where("consumed_at", "is", null)
            .where("invalidated_at", "is", null)
            .execute();
          await transaction
            .insertInto("iam_password_recoveries")
            .values({
              id: randomUUID(),
              user_id: user.id,
              token_hash: this.hash(token),
              email_fingerprint: fingerprint,
              expires_at: new Date(
                now.getTime() + policy.recovery.tokenMinutes * 60_000,
              ),
              consumed_at: null,
              invalidated_at: null,
              created_at: now,
            })
            .execute();
        });
        await this.sendLink(
          user.email,
          "Account recovery",
          this.options.recoveryUrl,
          token,
        );
      }
    }
    await this.audit(
      "account.recovery.requested",
      "success",
      {
        ...context,
        actorType: "anonymous",
        ...(user ? { subjectId: user.id } : {}),
      },
      { emailFingerprint: fingerprint },
    );
  }

  async resetPassword(
    token: string,
    password: string,
    confirmation: string,
    context: SecurityContext,
  ): Promise<void> {
    if (password !== confirmation) {
      throw new SecurityError("PASSWORD_CONFIRMATION_MISMATCH");
    }
    const tokenHash = this.hash(token);
    const recovery = await this.options.db
      .selectFrom("iam_password_recoveries")
      .innerJoin("iam_users", "iam_users.id", "iam_password_recoveries.user_id")
      .select([
        "iam_password_recoveries.id",
        "iam_password_recoveries.user_id",
        "iam_password_recoveries.expires_at",
        "iam_password_recoveries.consumed_at",
        "iam_password_recoveries.invalidated_at",
        "iam_users.role",
      ])
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();
    if (
      !recovery ||
      recovery.consumed_at ||
      recovery.invalidated_at ||
      recovery.expires_at <= new Date()
    ) {
      throw new SecurityError("RECOVERY_TOKEN_INVALID", 400);
    }
    await this.assertPasswordPolicy(password, recovery.role);
    const plain = PasswordPlainValueObject.create(password);
    if (!plain.success) {
      throw new SecurityError("PASSWORD_INVALID");
    }
    const hash = await this.options.passwordHasher.hash(plain.value);
    const consumedAt = new Date();
    const consumed = await this.options.db
      .transaction()
      .execute(async (transaction) => {
        const update = await transaction
          .updateTable("iam_password_recoveries")
          .set({ consumed_at: consumedAt })
          .where("id", "=", recovery.id)
          .where("consumed_at", "is", null)
          .where("invalidated_at", "is", null)
          .where("expires_at", ">", consumedAt)
          .executeTakeFirst();
        if (Number(update.numUpdatedRows) !== 1) {
          return false;
        }
        await transaction
          .updateTable("iam_users")
          .set({ password_hash: hash.value, updated_at: consumedAt })
          .where("id", "=", recovery.user_id)
          .execute();
        await transaction
          .updateTable("iam_password_recoveries")
          .set({ invalidated_at: consumedAt })
          .where("user_id", "=", recovery.user_id)
          .where("consumed_at", "is", null)
          .execute();
        return true;
      });
    if (!consumed) {
      throw new SecurityError("RECOVERY_TOKEN_INVALID");
    }
    await this.revokeSessions(recovery.user_id);
    await this.audit("account.recovery.completed", "success", {
      ...context,
      actorType: "anonymous",
      subjectId: recovery.user_id,
    });
  }

  async beginMfaEnrollment(
    userId: string,
    sessionId: string,
    password: string,
  ) {
    await this.verifyRecentPassword(userId, sessionId, password);
    const policy = await this.policy();
    if (!policy.authentication.mfaAvailable) {
      throw new SecurityError("MFA_UNAVAILABLE", 403);
    }
    const user = await this.user(userId);
    const secret = base32Encode(randomBytes(20));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60_000);
    await this.options.db
      .insertInto("iam_mfa_settings")
      .values({
        user_id: userId,
        encrypted_secret: this.encrypt(secret),
        enrollment_expires_at: expiresAt,
        enabled_at: null,
        last_totp_counter: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((conflict) =>
        conflict.column("user_id").doUpdateSet({
          encrypted_secret: this.encrypt(secret),
          enrollment_expires_at: expiresAt,
          enabled_at: null,
          last_totp_counter: null,
          updated_at: now,
        }),
      )
      .execute();
    const uri = `otpauth://totp/${encodeURIComponent("Architecture")}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent("Architecture")}&algorithm=SHA1&digits=6&period=30`;
    return {
      secret,
      otpauthUri: uri,
      qrCodeDataUrl: await QRCode.toDataURL(uri, { errorCorrectionLevel: "M" }),
      expiresAt,
    };
  }

  async confirmMfaEnrollment(userId: string, code: string) {
    const setting = await this.mfaSetting(userId);
    if (
      setting.enabled_at ||
      !setting.enrollment_expires_at ||
      setting.enrollment_expires_at <= new Date()
    ) {
      throw new SecurityError("MFA_ENROLLMENT_INVALID");
    }
    const enrollmentExpiresAt = setting.enrollment_expires_at;
    const secret = this.decrypt(setting.encrypted_secret);
    const counter = verifyTotp(secret, code);
    if (
      counter === null ||
      (setting.last_totp_counter !== null &&
        BigInt(counter) <= BigInt(setting.last_totp_counter))
    ) {
      throw new SecurityError("MFA_CODE_INVALID");
    }
    const backupCodes = this.generateBackupCodes();
    const now = new Date();
    const confirmationId = randomUUID();
    await this.options.db.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("iam_mfa_settings")
        .set({
          last_totp_counter: String(counter),
          updated_at: now,
        })
        .where("user_id", "=", userId)
        .where("enabled_at", "is", null)
        .execute();
      await transaction
        .deleteFrom("iam_mfa_backup_codes")
        .where("user_id", "=", userId)
        .execute();
      await transaction
        .insertInto("iam_mfa_backup_codes")
        .values(
          backupCodes.map((backupCode) => ({
            id: randomUUID(),
            user_id: userId,
            code_hash: this.hash(backupCode),
            consumed_at: null,
            created_at: now,
          })),
        )
        .execute();
      await transaction
        .insertInto("iam_mfa_challenges")
        .values({
          id: confirmationId,
          user_id: userId,
          purpose: "enrollment_confirmation",
          attempts: 0,
          max_attempts: 1,
          expires_at: enrollmentExpiresAt,
          consumed_at: null,
          created_at: now,
        })
        .execute();
    });
    return { backupCodes, confirmationId };
  }

  async finalizeMfaEnrollment(
    userId: string,
    confirmationId: string,
    backupCodesSaved: boolean,
  ) {
    if (!backupCodesSaved) {
      throw new SecurityError("MFA_BACKUP_CODES_CONFIRMATION_REQUIRED");
    }
    const now = new Date();
    const finalized = await this.options.db
      .transaction()
      .execute(async (transaction) => {
        const challenge = await transaction
          .selectFrom("iam_mfa_challenges")
          .select("id")
          .where("id", "=", confirmationId)
          .where("user_id", "=", userId)
          .where("purpose", "=", "enrollment_confirmation")
          .where("consumed_at", "is", null)
          .where("expires_at", ">", now)
          .forUpdate()
          .executeTakeFirst();
        if (!challenge) {
          return false;
        }
        await transaction
          .updateTable("iam_mfa_challenges")
          .set({ consumed_at: now })
          .where("id", "=", challenge.id)
          .execute();
        await transaction
          .updateTable("iam_mfa_settings")
          .set({
            enabled_at: now,
            enrollment_expires_at: null,
            updated_at: now,
          })
          .where("user_id", "=", userId)
          .where("enabled_at", "is", null)
          .execute();
        return true;
      });
    if (!finalized) {
      throw new SecurityError("MFA_ENROLLMENT_INVALID");
    }
    await this.revokeSessions(userId);
    await this.audit("mfa.activated", "success", {
      actorType: "user",
      actorId: userId,
      subjectId: userId,
    });
  }

  async mfaStatus(userId: string) {
    const setting = await this.options.db
      .selectFrom("iam_mfa_settings")
      .select(["enabled_at"])
      .where("user_id", "=", userId)
      .executeTakeFirst();
    const remaining = setting?.enabled_at
      ? await this.options.db
          .selectFrom("iam_mfa_backup_codes")
          .select(({ fn }) => fn.countAll<number>().as("count"))
          .where("user_id", "=", userId)
          .where("consumed_at", "is", null)
          .executeTakeFirstOrThrow()
      : { count: 0 };
    return {
      enabled: Boolean(setting?.enabled_at),
      enabledAt: setting?.enabled_at ?? null,
      backupCodesRemaining: Number(remaining.count),
      lowBackupCodes: Number(remaining.count) <= 2,
    };
  }

  async beginSignIn(userId: string): Promise<SecondFactorChallenge | null> {
    const [setting, policy, user] = await Promise.all([
      this.options.db
        .selectFrom("iam_mfa_settings")
        .select("enabled_at")
        .where("user_id", "=", userId)
        .executeTakeFirst(),
      this.policy(),
      this.user(userId),
    ]);
    const roleRequired = policy.authentication.mfaRequiredRoles.includes(
      user.role as "user" | "admin",
    );
    if (!setting?.enabled_at) {
      if (roleRequired) {
        throw new SecurityError("MFA_ENROLLMENT_REQUIRED", 403);
      }
      return null;
    }
    const now = new Date();
    const existing = await this.options.db
      .selectFrom("iam_mfa_challenges")
      .select(["id", "expires_at"])
      .where("user_id", "=", userId)
      .where("purpose", "=", "signin")
      .where("consumed_at", "is", null)
      .where("expires_at", ">", now)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    if (existing) {
      return {
        mfaRequired: true,
        userId,
        sessionId: null,
        sessionExpiresAt: null,
        challengeId: existing.id,
        expiresAt: existing.expires_at,
      };
    }
    const challenge: SecondFactorChallenge = {
      mfaRequired: true,
      userId,
      sessionId: null,
      sessionExpiresAt: null,
      challengeId: randomUUID(),
      expiresAt: new Date(
        now.getTime() + policy.authentication.mfaChallengeMinutes * 60_000,
      ),
    };
    await this.options.db
      .insertInto("iam_mfa_challenges")
      .values({
        id: challenge.challengeId,
        user_id: userId,
        purpose: "signin",
        attempts: 0,
        max_attempts: policy.authentication.mfaMaxAttempts,
        expires_at: challenge.expiresAt,
        consumed_at: null,
        created_at: now,
      })
      .execute();
    return challenge;
  }

  async completeMfaSignIn(
    challengeId: string,
    code: string,
    metadata?: Pick<
      Parameters<typeof SessionEntity.createForUser>[0],
      "client" | "network"
    >,
  ) {
    const verification = await this.consumeChallenge(challengeId, code);
    const identifier = UserIdentifierValueObject.create(verification.userId);
    if (!identifier.success) {
      throw new SecurityError("MFA_CHALLENGE_INVALID");
    }
    const user = await this.options.db
      .selectFrom("iam_users")
      .select(["session_version", "status"])
      .where("id", "=", identifier.value.value)
      .executeTakeFirst();
    if (!user || user.status !== "active") {
      throw new SecurityError("MFA_CHALLENGE_INVALID");
    }
    const session = SessionEntity.createForUser({
      userId: identifier.value,
      userSessionVersion: user.session_version,
      expiresAt: new Date(
        Date.now() + (await this.getSessionDurationMinutes()) * 60_000,
      ),
      ...(metadata?.client ? { client: metadata.client } : {}),
      ...(metadata?.network ? { network: metadata.network } : {}),
    });
    await this.options.sessions.saveEnforcingMaximum(
      session,
      MAX_ACTIVE_SESSIONS_PER_USER,
    );
    await this.audit(
      "authentication.signin",
      "success",
      {
        actorType: "user",
        actorId: verification.userId,
        subjectId: verification.userId,
      },
      { secondFactor: verification.method },
    );
    return {
      sessionId: session.identifier.value,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async regenerateBackupCodes(
    userId: string,
    sessionId: string,
    password: string,
    code: string,
  ) {
    await this.verifyRecentPassword(userId, sessionId, password);
    await this.verifyFactor(userId, code, true);
    const backupCodes = this.generateBackupCodes();
    const now = new Date();
    await this.options.db.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom("iam_mfa_backup_codes")
        .where("user_id", "=", userId)
        .execute();
      await transaction
        .insertInto("iam_mfa_backup_codes")
        .values(
          backupCodes.map((backupCode) => ({
            id: randomUUID(),
            user_id: userId,
            code_hash: this.hash(backupCode),
            consumed_at: null,
            created_at: now,
          })),
        )
        .execute();
    });
    await this.audit("mfa.backup_codes.regenerated", "success", {
      actorType: "user",
      actorId: userId,
      subjectId: userId,
    });
    return { backupCodes };
  }

  async disableMfa(
    userId: string,
    sessionId: string,
    password: string,
    code: string,
  ) {
    await this.verifyRecentPassword(userId, sessionId, password);
    const user = await this.user(userId);
    const policy = await this.policy();
    if (
      policy.authentication.mfaRequiredRoles.includes(
        user.role as "user" | "admin",
      )
    ) {
      throw new SecurityError("MFA_REQUIRED_BY_POLICY", 409);
    }
    await this.verifyFactor(userId, code, true);
    await this.options.db
      .deleteFrom("iam_mfa_settings")
      .where("user_id", "=", userId)
      .execute();
    await this.revokeSessions(userId);
    await this.audit("mfa.disabled", "success", {
      actorType: "user",
      actorId: userId,
      subjectId: userId,
    });
  }

  async requestExport(
    userId: string,
    sessionId: string,
    password: string,
    code?: string,
  ) {
    const policy = await this.policy();
    if (!policy.accounts.export) {
      throw new SecurityError("EXPORT_DISABLED", 403);
    }
    await this.verifyStrongAuthentication(userId, sessionId, password, code);
    const existing = await this.options.db
      .selectFrom("iam_account_exports")
      .select(["id", "status", "expires_at"])
      .where("user_id", "=", userId)
      .where("status", "in", ["pending", "ready"])
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    if (
      existing &&
      (!existing.expires_at || existing.expires_at > new Date())
    ) {
      return existing;
    }
    const id = randomUUID();
    const now = new Date();
    await this.options.db
      .insertInto("iam_account_exports")
      .values({
        id,
        user_id: userId,
        status: "pending",
        archive: null,
        failure_code: null,
        expires_at: null,
        downloaded_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await this.generateExport(id, userId);
    return { id, status: "ready" as const };
  }

  async listExports(userId: string) {
    await this.expireExports();
    return this.options.db
      .selectFrom("iam_account_exports")
      .select([
        "id",
        "status",
        "failure_code",
        "expires_at",
        "downloaded_at",
        "created_at",
      ])
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
  }

  async downloadExport(userId: string, exportId: string): Promise<Buffer> {
    const now = new Date();
    return this.options.db.transaction().execute(async (transaction) => {
      const item = await transaction
        .selectFrom("iam_account_exports")
        .select(["archive", "expires_at", "status"])
        .where("id", "=", exportId)
        .where("user_id", "=", userId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !item?.archive ||
        item.status !== "ready" ||
        !item.expires_at ||
        item.expires_at <= now
      ) {
        throw new SecurityError("EXPORT_NOT_AVAILABLE", 404);
      }
      await transaction
        .updateTable("iam_account_exports")
        .set({
          status: "expired",
          archive: null,
          downloaded_at: now,
          updated_at: now,
        })
        .where("id", "=", exportId)
        .execute();
      await this.audit(
        "account.export.downloaded",
        "success",
        {
          actorType: "user",
          actorId: userId,
          subjectId: userId,
        },
        { exportId },
      );
      return Buffer.from(item.archive);
    });
  }

  async requestDeletion(
    userId: string,
    sessionId: string,
    password: string,
    confirmation: string,
    code?: string,
  ) {
    if (confirmation !== "DELETE") {
      throw new SecurityError("DELETION_CONFIRMATION_REQUIRED");
    }
    const policy = await this.policy();
    if (!policy.accounts.deletion) {
      throw new SecurityError("DELETION_DISABLED", 403);
    }
    await this.verifyStrongAuthentication(userId, sessionId, password, code);
    const user = await this.user(userId);
    if (user.role === "admin" && user.status === "active") {
      const count = await this.options.db
        .selectFrom("iam_users")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("role", "=", "admin")
        .where("status", "=", "active")
        .executeTakeFirstOrThrow();
      if (Number(count.count) <= 1) {
        throw new SecurityError("LAST_ACTIVE_ADMIN", 409);
      }
    }
    const token = this.token();
    const now = new Date();
    const scheduledFor = new Date(
      now.getTime() + policy.accounts.deletionGraceDays * 86_400_000,
    );
    await this.options.db.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("iam_account_deletions")
        .values({
          id: randomUUID(),
          user_id: userId,
          previous_status: user.status,
          cancellation_token_hash: this.hash(token),
          requested_at: now,
          scheduled_for: scheduledFor,
          cancelled_at: null,
          executed_at: null,
          legal_hold_reason: null,
        })
        .onConflict((conflict) =>
          conflict.column("user_id").doUpdateSet({
            previous_status: user.status,
            cancellation_token_hash: this.hash(token),
            requested_at: now,
            scheduled_for: scheduledFor,
            cancelled_at: null,
            executed_at: null,
          }),
        )
        .execute();
      await transaction
        .updateTable("iam_users")
        .set({ status: "pending_deletion", updated_at: now })
        .where("id", "=", userId)
        .execute();
      await transaction
        .updateTable("iam_password_recoveries")
        .set({ invalidated_at: now })
        .where("user_id", "=", userId)
        .where("consumed_at", "is", null)
        .execute();
    });
    await this.revokeSessions(userId);
    await this.sendLink(
      user.email,
      "Cancel account deletion",
      this.options.deletionCancellationUrl,
      token,
    );
    await this.audit(
      "account.deletion.requested",
      "success",
      {
        actorType: "user",
        actorId: userId,
        subjectId: userId,
      },
      { scheduledFor: scheduledFor.toISOString() },
    );
    return { scheduledFor };
  }

  async cancelDeletion(token: string, password: string, code?: string) {
    const request = await this.options.db
      .selectFrom("iam_account_deletions")
      .selectAll()
      .where("cancellation_token_hash", "=", this.hash(token))
      .executeTakeFirst();
    if (
      !request ||
      request.cancelled_at ||
      request.executed_at ||
      request.scheduled_for <= new Date()
    ) {
      throw new SecurityError("DELETION_TOKEN_INVALID");
    }
    await this.verifyPassword(request.user_id, password);
    const setting = await this.options.db
      .selectFrom("iam_mfa_settings")
      .select("enabled_at")
      .where("user_id", "=", request.user_id)
      .executeTakeFirst();
    if (setting?.enabled_at) {
      if (!code) {
        throw new SecurityError("MFA_CODE_REQUIRED");
      }
      await this.verifyFactor(request.user_id, code, true);
    }
    const now = new Date();
    const updated = await this.options.db
      .transaction()
      .execute(async (transaction) => {
        const result = await transaction
          .updateTable("iam_account_deletions")
          .set({ cancelled_at: now })
          .where("id", "=", request.id)
          .where("cancelled_at", "is", null)
          .where("executed_at", "is", null)
          .executeTakeFirst();
        if (Number(result.numUpdatedRows) !== 1) {
          return false;
        }
        await transaction
          .updateTable("iam_users")
          .set({ status: request.previous_status, updated_at: now })
          .where("id", "=", request.user_id)
          .execute();
        return true;
      });
    if (!updated) {
      throw new SecurityError("DELETION_TOKEN_INVALID");
    }
    await this.audit("account.deletion.cancelled", "success", {
      actorType: "user",
      actorId: request.user_id,
      subjectId: request.user_id,
    });
  }

  async processMaintenance() {
    const now = new Date();
    const due = await this.options.db
      .selectFrom("iam_account_deletions")
      .select(["id", "user_id"])
      .where("scheduled_for", "<=", now)
      .where("cancelled_at", "is", null)
      .where("executed_at", "is", null)
      .where("legal_hold_reason", "is", null)
      .execute();
    for (const deletion of due) {
      await this.options.audit.pseudonymize(deletion.user_id);
      await this.options.db.transaction().execute(async (transaction) => {
        await transaction
          .deleteFrom("iam_users")
          .where("id", "=", deletion.user_id)
          .execute();
      });
      await this.revokeSessions(deletion.user_id);
      await this.audit(
        "account.deletion.executed",
        "success",
        {
          actorType: "system",
        },
        { pseudonymousSubject: this.hash(deletion.user_id) },
      );
    }
    await this.expireExports();
    const purgedEvents = await this.options.audit.purge(now);
    return {
      deletedAccounts: due.length,
      purgedEvents,
    };
  }

  async listOwnAudit(userId: string, page: number, pageSize: number) {
    const policy = await this.policy();
    if (!policy.audit.consultation) {
      throw new SecurityError("AUDIT_CONSULTATION_DISABLED", 403);
    }
    return (await this.options.audit.listOwn(userId, page, pageSize)).map(
      toAuditResponse,
    );
  }

  async listAdminAudit(
    actorId: string,
    filters: {
      page: number;
      pageSize: number;
      type?: string;
      result?: string;
      actorId?: string;
      subjectId?: string;
      correlationId?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const rows = await this.options.audit.list(filters);
    await this.audit(
      "security.audit.consulted",
      "success",
      {
        actorType: "administrator",
        actorId,
        subjectId: actorId,
      },
      { filters: redact(filters) },
    );
    return rows.map(toAuditResponse);
  }

  async audit(
    type: string,
    result: AuditResult,
    context: SecurityContext,
    metadata: Record<string, unknown> = {},
  ) {
    const policy = await this.policy();
    const eventId = randomUUID();
    const occurredAt = new Date();
    await this.options.audit.record({
      id: eventId,
      type,
      occurredAt,
      result,
      context,
      metadata: redact(metadata) as Record<string, unknown>,
      retentionDays: policy.audit.retentionDays,
    });
    if (
      result === "success" &&
      context.subjectId &&
      NOTIFIABLE_SECURITY_EVENTS.has(type)
    ) {
      await this.options.outbox.append([
        {
          eventId: randomUUID(),
          topic: type,
          version: 1,
          aggregateId: context.subjectId,
          occurredAt,
          payload: { userId: context.subjectId },
          context: {
            actorType: context.actorType,
            ...(context.actorId ? { actorId: context.actorId } : {}),
            subjectId: context.subjectId,
            ...(context.correlationId
              ? { correlationId: context.correlationId }
              : {}),
          },
        },
      ]);
    }
  }

  private async generateExport(exportId: string, userId: string) {
    try {
      const [account, sessions, auditEvents, exports, deletions] =
        await Promise.all([
          this.user(userId),
          this.activeSessions(userId),
          this.exportableAuditEvents(userId),
          this.options.db
            .selectFrom("iam_account_exports")
            .select([
              "id",
              "status",
              "created_at",
              "expires_at",
              "downloaded_at",
            ])
            .where("user_id", "=", userId)
            .execute(),
          this.options.db
            .selectFrom("iam_account_deletions")
            .select([
              "id",
              "requested_at",
              "scheduled_for",
              "cancelled_at",
              "executed_at",
            ])
            .where("user_id", "=", userId)
            .execute(),
        ]);
      const manifest = {
        format: "architecture-account-export",
        version: 1,
        generatedAt: new Date().toISOString(),
        files: [
          "account.json",
          "sessions.json",
          "security-events.json",
          "requests.json",
        ],
      };
      const files = {
        "manifest.json": JSON.stringify(manifest, null, 2),
        "account.json": JSON.stringify(
          {
            id: account.id,
            email: account.email,
            role: account.role,
            status: account.status,
            isEmailVerified: account.is_email_verified,
            createdAt: account.created_at,
            updatedAt: account.updated_at,
          },
          null,
          2,
        ),
        "sessions.json": JSON.stringify(
          sessions.map((session) => ({
            id: session.identifier.value,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            expiresAt: session.expiresAt,
            client: session.client,
            network: session.network,
          })),
          null,
          2,
        ),
        "security-events.json": JSON.stringify(auditEvents, null, 2),
        "requests.json": JSON.stringify({ exports, deletions }, null, 2),
      };
      const now = new Date();
      await this.options.db
        .updateTable("iam_account_exports")
        .set({
          status: "ready",
          archive: createZip(files),
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          updated_at: now,
        })
        .where("id", "=", exportId)
        .execute();
      await this.audit(
        "account.export.generated",
        "success",
        {
          actorType: "system",
          subjectId: userId,
        },
        { exportId },
      );
    } catch {
      await this.options.db
        .updateTable("iam_account_exports")
        .set({
          status: "failed",
          archive: null,
          failure_code: "GENERATION_FAILED",
          updated_at: new Date(),
        })
        .where("id", "=", exportId)
        .execute();
      throw new SecurityError("EXPORT_GENERATION_FAILED", 500);
    }
  }

  private async consumeChallenge(
    challengeId: string,
    code: string,
  ): Promise<MfaVerification> {
    const challenge = await this.options.db
      .selectFrom("iam_mfa_challenges")
      .selectAll()
      .where("id", "=", challengeId)
      .executeTakeFirst();
    const now = new Date();
    if (
      !challenge ||
      challenge.consumed_at ||
      challenge.expires_at <= now ||
      challenge.attempts >= challenge.max_attempts
    ) {
      throw new SecurityError("MFA_CHALLENGE_INVALID", 401);
    }
    await this.options.db
      .updateTable("iam_mfa_challenges")
      .set({ attempts: challenge.attempts + 1 })
      .where("id", "=", challenge.id)
      .execute();
    const method = await this.verifyFactor(challenge.user_id, code, true);
    const consumed = await this.options.db
      .updateTable("iam_mfa_challenges")
      .set({ consumed_at: now })
      .where("id", "=", challenge.id)
      .where("consumed_at", "is", null)
      .executeTakeFirst();
    if (Number(consumed.numUpdatedRows) !== 1) {
      throw new SecurityError("MFA_CHALLENGE_INVALID", 401);
    }
    return { userId: challenge.user_id, method };
  }

  private async verifyStrongAuthentication(
    userId: string,
    sessionId: string,
    password: string,
    code?: string,
  ) {
    await this.verifyRecentPassword(userId, sessionId, password);
    const setting = await this.options.db
      .selectFrom("iam_mfa_settings")
      .select("enabled_at")
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (setting?.enabled_at) {
      if (!code) {
        throw new SecurityError("MFA_CODE_REQUIRED");
      }
      await this.verifyFactor(userId, code, true);
    }
  }

  private async verifyRecentPassword(
    userId: string,
    sessionId: string,
    password: string,
  ) {
    const id = SessionIdentifierValueObject.create(sessionId);
    if (!id.success) {
      throw new SecurityError("RECENT_AUTHENTICATION_REQUIRED", 401);
    }
    const session = await this.options.sessions.findById(id.value);
    const policy = await this.policy();
    if (
      !session ||
      session.userId.value !== userId ||
      Date.now() - session.createdAt.getTime() >
        policy.authentication.recentAuthenticationMinutes * 60_000
    ) {
      throw new SecurityError("RECENT_AUTHENTICATION_REQUIRED", 401);
    }
    await this.verifyPassword(userId, password);
  }

  private async verifyPassword(userId: string, password: string) {
    const user = await this.options.db
      .selectFrom("iam_users")
      .select("password_hash")
      .where("id", "=", userId)
      .executeTakeFirst();
    const plain = PasswordPlainValueObject.create(password);
    if (!user || !plain.success) {
      throw new SecurityError("INVALID_CREDENTIALS", 401);
    }
    const { PasswordHashValueObject } =
      await import("@architecture/iam/domain");
    const hash = PasswordHashValueObject.create(user.password_hash);
    if (
      !hash.success ||
      !(await this.options.passwordHasher.verify(plain.value, hash.value))
    ) {
      throw new SecurityError("INVALID_CREDENTIALS", 401);
    }
  }

  private async verifyFactor(
    userId: string,
    code: string,
    consumeBackup: boolean,
  ): Promise<"totp" | "backup_code"> {
    const setting = await this.mfaSetting(userId);
    if (!setting.enabled_at) {
      throw new SecurityError("MFA_NOT_ENABLED", 409);
    }
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    if (/^\d{6}$/.test(normalized)) {
      const counter = verifyTotp(
        this.decrypt(setting.encrypted_secret),
        normalized,
      );
      if (
        counter !== null &&
        (setting.last_totp_counter === null ||
          BigInt(counter) > BigInt(setting.last_totp_counter))
      ) {
        const result = await this.options.db
          .updateTable("iam_mfa_settings")
          .set({ last_totp_counter: String(counter), updated_at: new Date() })
          .where("user_id", "=", userId)
          .where((expression) =>
            setting.last_totp_counter === null
              ? expression("last_totp_counter", "is", null)
              : expression("last_totp_counter", "=", setting.last_totp_counter),
          )
          .executeTakeFirst();
        if (Number(result.numUpdatedRows) === 1) {
          return "totp";
        }
      }
    }
    const backup = await this.options.db
      .selectFrom("iam_mfa_backup_codes")
      .select("id")
      .where("user_id", "=", userId)
      .where("code_hash", "=", this.hash(normalized))
      .where("consumed_at", "is", null)
      .executeTakeFirst();
    if (backup) {
      if (consumeBackup) {
        const result = await this.options.db
          .updateTable("iam_mfa_backup_codes")
          .set({ consumed_at: new Date() })
          .where("id", "=", backup.id)
          .where("consumed_at", "is", null)
          .executeTakeFirst();
        if (Number(result.numUpdatedRows) !== 1) {
          throw new SecurityError("MFA_CODE_INVALID", 401);
        }
      }
      await this.audit("mfa.backup_code.used", "success", {
        actorType: "user",
        actorId: userId,
        subjectId: userId,
      });
      return "backup_code";
    }
    throw new SecurityError("MFA_CODE_INVALID", 401);
  }

  private async mfaSetting(userId: string) {
    const setting = await this.options.db
      .selectFrom("iam_mfa_settings")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!setting) {
      throw new SecurityError("MFA_NOT_CONFIGURED", 404);
    }
    return setting;
  }

  private async user(userId: string) {
    const user = await this.options.db
      .selectFrom("iam_users")
      .selectAll()
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) {
      throw new SecurityError("USER_NOT_FOUND", 404);
    }
    return user;
  }

  private async revokeSessions(userId: string) {
    const id = UserIdentifierValueObject.create(userId);
    if (id.success) {
      await this.options.sessions.deleteAllForUser(id.value);
    }
  }

  private async activeSessions(userId: string) {
    const id = UserIdentifierValueObject.create(userId);
    if (!id.success) {
      return [];
    }
    return this.options.sessions.findActiveForUser(id.value);
  }

  private async exportableAuditEvents(userId: string) {
    return (await this.options.audit.exportFor(userId)).map(toAuditResponse);
  }

  private async assertPasswordPolicy(password: string, role: string) {
    const policy = await this.policy();
    const min =
      role === "admin"
        ? policy.passwords.privilegedMinLength
        : policy.passwords.standardMinLength;
    if (
      [...password].length < min ||
      [...password].length > policy.passwords.maxLength
    ) {
      throw new SecurityError("PASSWORD_POLICY_VIOLATION");
    }
  }

  private generateBackupCodes() {
    return Array.from({ length: 10 }, () => {
      const value = randomBytes(8).toString("hex").toUpperCase();
      return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
    });
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return `${iv.toString("base64url")}.${cipher
      .getAuthTag()
      .toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  private decrypt(value: string) {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      throw new SecurityError("MFA_SECRET_INVALID", 500);
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private token() {
    return randomBytes(32).toString("base64url");
  }

  private hash(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }

  private async sendLink(
    email: string,
    subject: string,
    baseUrl: string,
    token: string,
  ) {
    const { EmailValueObject } = await import("@architecture/iam/domain");
    const to = EmailValueObject.create(email);
    if (!to.success) {
      return;
    }
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    await this.options.email.send(
      to.value,
      subject,
      `<p><a href="${url.href}">${subject}</a></p>`,
      url.href,
    );
  }

  private async expireExports() {
    await this.options.db
      .updateTable("iam_account_exports")
      .set({ status: "expired", archive: null, updated_at: new Date() })
      .where("status", "=", "ready")
      .where("expires_at", "<=", new Date())
      .execute();
  }
}

function validatePolicy(value: unknown): SecurityPolicy {
  const result = SecurityPolicySchema.safeParse(value);
  if (!result.success) {
    throw new SecurityError("CONFIG_INVALID");
  }
  return structuredClone(result.data);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) =>
        SENSITIVE_KEY.test(key) ? [] : [[key, redact(item)]],
      ),
    );
  }
  return value;
}

function diffKeys(before: unknown, after: unknown, prefix = ""): string[] {
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object"
  ) {
    return before === after ? [] : [prefix];
  }
  const first = before as Record<string, unknown>;
  const second = after as Record<string, unknown>;
  return [...new Set([...Object.keys(first), ...Object.keys(second)])].flatMap(
    (key) =>
      diffKeys(first[key], second[key], prefix ? `${prefix}.${key}` : key),
  );
}

function base32Encode(input: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of input) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output +=
      alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of input.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) {
      throw new SecurityError("MFA_SECRET_INVALID", 500);
    }
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function verifyTotp(secret: string, code: string): number | null {
  const current = Math.floor(Date.now() / 30_000);
  for (const counter of [current - 1, current, current + 1]) {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac("sha1", base32Decode(secret))
      .update(counterBuffer)
      .digest();
    const offset = (digest.at(-1) ?? 0) & 0x0f;
    const binary =
      ((digest[offset] ?? 0) & 0x7f) * 0x1000000 +
      (digest[offset + 1] ?? 0) * 0x10000 +
      (digest[offset + 2] ?? 0) * 0x100 +
      (digest[offset + 3] ?? 0);
    const expected = String(binary % 1_000_000).padStart(6, "0");
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(code);
    if (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return counter;
    }
  }
  return null;
}

function createZip(files: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export const securityInternals = {
  validatePolicy,
  redact,
  base32Encode,
  verifyTotp,
  createZip,
};
