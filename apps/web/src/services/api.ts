// @file apps/web/src/services/api.ts

export interface CurrentUser {
  userId: string;
  loginIdentifiers: LoginIdentityView[];
  email: string | null;
  isEmailVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

interface SessionDetails {
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  client: {
    type: "browser" | "application" | "unknown";
    name: string | null;
    version: string | null;
    deviceType: "desktop" | "phone" | "tablet" | "unknown";
    operatingSystem: {
      name: string;
      version: string | null;
    } | null;
  };
  network: {
    ipAddress: string | null;
    location: {
      country: string;
      region: string | null;
      city: string | null;
    } | null;
  };
}

export interface CurrentUserSession extends SessionDetails {
  isCurrent: boolean;
}

export type AdministeredUserSession = SessionDetails;

export interface AdminUser {
  userId: string;
  loginIdentifiers: LoginIdentityView[];
  email: string | null;
  isEmailVerified: boolean;
  role: "user" | "admin";
  status: "active" | "suspended" | "pending_deletion";
  createdAt: string;
  updatedAt: string;
}

export interface LoginIdentityView {
  kind: "username" | "email";
  value: string;
  verificationStatus: "not_required" | "pending" | "verified";
}

export function accountDisplayIdentifier(account: {
  userId: string;
  loginIdentifiers: LoginIdentityView[];
}): string {
  return (
    account.loginIdentifiers.find((identity) => identity.kind === "username")
      ?.value ??
    account.loginIdentifiers.find((identity) => identity.kind === "email")
      ?.value ??
    account.userId
  );
}

export interface ListUsersCriteria {
  search?: string;
  role?: AdminUser["role"];
  status?: AdminUser["status"];
  emailVerified?: boolean;
  page: number;
  pageSize: number;
}

export interface UserListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListUsersResult {
  users: AdminUser[];
  pagination: UserListPagination;
}

export interface UserAdministrationOverview {
  total: number;
  active: number;
  suspended: number;
  administrators: number;
}

export interface SignInPayload {
  login: LoginIdentifierPayload;
  password: string;
}

export interface SignUpPayload {
  login: LoginIdentifierPayload;
  password: string;
  passwordConfirmation: string;
}

export interface LoginIdentifierPayload {
  kind: "username" | "email";
  value: string;
}

export interface ChangeEmailPayload {
  email: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  severity: "information" | "warning" | "critical";
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreference {
  channel: "email" | "slack" | "sms";
  enabled: boolean;
}

export interface PasswordPolicy {
  level: "standard" | "elevated" | "critical" | "custom";
  minLength: number;
  maxLength: number;
  minimumStrength:
    "too_weak" | "weak" | "acceptable" | "strong" | "very_strong";
  checks: {
    commonPasswords: boolean;
    compromisedPasswords: boolean;
    userContext: boolean;
  };
  composition: {
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecialCharacter: boolean;
  };
  lengthUnit: "unicode_code_points";
  normalization: "none";
}

export interface PasswordEvaluation {
  valid: boolean;
  strength: PasswordPolicy["minimumStrength"];
  errorCodes: string[];
}

export interface PublicCapabilities {
  publicRegistration: boolean;
  allowedLoginIdentifiers: LoginIdentifierPayload["kind"][];
  emailVerification: boolean;
  emailChange: boolean;
  sessionManagement: boolean;
  recovery: boolean;
  mfa: boolean;
  accountExport: boolean;
  accountDeletion: boolean;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/v1";

interface ApiResponse<T, TMeta = never> {
  data: T;
  meta?: TMeta;
}

interface ApiError {
  error: {
    code: string;
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await requestEnvelope<T>(path, init);
  if (response === null) {
    throw new Error("INVALID_RESPONSE");
  }
  return response.data;
}

async function requestVoid(path: string, init: RequestInit): Promise<void> {
  await requestEnvelope(path, init);
}

async function requestEnvelope<T, TMeta = never>(
  path: string,
  init: RequestInit,
): Promise<ApiResponse<T, TMeta> | null> {
  const headers: Record<string, string> = {};

  if (init.body !== undefined && init.body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    mode: "cors",
    headers,
    credentials: "include",
    ...init,
  });

  if (response.status === 204) {
    return { data: null as unknown as T };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T, TMeta> | ApiError)
    : null;

  if (!response.ok) {
    const apiError = body as ApiError | null;
    throw new Error(apiError?.error?.code ?? `HTTP_${response.status}`);
  }

  return body as ApiResponse<T, TMeta>;
}

export async function signUp(payload: SignUpPayload) {
  return request<{ userId: string }>("/iam/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPasswordPolicy(): Promise<PasswordPolicy> {
  return request<PasswordPolicy>("/iam/password-policy", {
    method: "GET",
  });
}

export function getPublicCapabilities(): Promise<PublicCapabilities> {
  return request<PublicCapabilities>("/iam/capabilities", {
    method: "GET",
  });
}

export function evaluatePassword(
  password: string,
): Promise<PasswordEvaluation> {
  return request<PasswordEvaluation>("/iam/password-policy/evaluate", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function signIn(payload: SignInPayload) {
  const response = await requestEnvelope<{
    mfaRequired: true;
    challengeId: string;
    expiresAt: string;
  }>("/iam/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response?.data;
}

export async function verifyMfaChallenge(challengeId: string, code: string) {
  await requestVoid("/iam/mfa/challenge/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, code }),
  });
}

export async function requestAccountRecovery(email: string) {
  await requestVoid("/iam/recovery", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetRecoveredPassword(
  token: string,
  password: string,
  passwordConfirmation: string,
) {
  await requestVoid("/iam/recovery/reset", {
    method: "POST",
    body: JSON.stringify({ token, password, passwordConfirmation }),
  });
}

export async function cancelAccountDeletion(
  token: string,
  password: string,
  mfaCode?: string,
) {
  await requestVoid("/iam/deletion/cancel", {
    method: "POST",
    body: JSON.stringify({ token, password, mfaCode }),
  });
}

export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
  lowBackupCodes: boolean;
}

export function getMfaStatus(): Promise<MfaStatus> {
  return request<MfaStatus>("/iam/me/mfa", { method: "GET" });
}

export function beginMfaEnrollment(password: string) {
  return request<{
    secret: string;
    otpauthUri: string;
    qrCodeDataUrl: string;
    expiresAt: string;
  }>("/iam/me/mfa/enrollment", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function confirmMfaEnrollment(code: string) {
  return request<{ backupCodes: string[]; confirmationId: string }>(
    "/iam/me/mfa/enrollment/confirm",
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
  );
}

export async function finalizeMfaEnrollment(confirmationId: string) {
  await requestVoid("/iam/me/mfa/enrollment/backup-codes/confirm", {
    method: "POST",
    body: JSON.stringify({ confirmationId, backupCodesSaved: true }),
  });
}

export async function disableMfa(
  password: string,
  mfaCode: string,
): Promise<void> {
  await requestVoid("/iam/me/mfa", {
    method: "DELETE",
    body: JSON.stringify({ password, mfaCode }),
  });
}

export function requestAccountExport(password: string, mfaCode?: string) {
  return request<{ id: string; status: string }>("/iam/me/exports", {
    method: "POST",
    body: JSON.stringify({ password, mfaCode }),
  });
}

export function listAccountExports() {
  return request<
    {
      id: string;
      status: "pending" | "ready" | "expired" | "failed";
      expires_at: string | null;
      created_at: string;
    }[]
  >("/iam/me/exports", { method: "GET" });
}

export function accountExportDownloadUrl(exportId: string) {
  return `${API_BASE_URL}/iam/me/exports/${encodeURIComponent(exportId)}/download`;
}

export function listSecurityEvents() {
  return request<
    {
      id: string;
      type: string;
      occurred_at: string;
      result: string;
    }[]
  >("/iam/me/security-events?page=1&pageSize=25", { method: "GET" });
}

export function requestAccountDeletion(
  password: string,
  confirmation: string,
  mfaCode?: string,
) {
  return request<{ scheduledFor: string }>("/iam/me/deletion", {
    method: "POST",
    body: JSON.stringify({ password, confirmation, mfaCode }),
  });
}

export interface SecurityConfigCenter {
  effectiveRevision: { id: string; version: number };
  catalog: {
    key: string;
    category: string;
    labelKey: string;
    descriptionKey: string;
    control: "switch" | "number" | "slider-number" | "select" | "multi-select";
    type: "boolean" | "integer" | "duration" | "choice" | "set";
    impact: "medium" | "high" | "critical";
    constraints?: {
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      choices?: string[];
    };
    recommendedValue: unknown;
    availability: {
      available: boolean;
      readOnly: boolean;
      reason?: string;
    };
  }[];
  effective: Record<string, unknown>;
  revisions: {
    id: string;
    version: number;
    status: string;
    created_by: string;
    created_at: string;
    published_at: string | null;
  }[];
}

export function getSecurityConfig() {
  return request<SecurityConfigCenter>("/iam/admin/security/config", {
    method: "GET",
  });
}

export function publishSecurityConfig(
  values: Record<string, unknown>,
  expectedVersion: number,
  justification: string,
  confirmedCritical: boolean,
) {
  return request("/iam/admin/security/config", {
    method: "PUT",
    body: JSON.stringify({
      values,
      expectedVersion,
      justification,
      confirmedCritical,
    }),
  });
}

export function previewSecurityConfig(values: Record<string, unknown>) {
  return request<{
    valid: boolean;
    changedKeys: string[];
    impact: string;
    affectedAccounts: { administratorsRequiringEnrollment: number };
    changes: { key: string; before: unknown; after: unknown }[];
    warnings: string[];
  }>("/iam/admin/security/config/preview", {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

export function rollbackSecurityConfig(revisionId: string) {
  return request(`/iam/admin/security/config/${revisionId}/rollback`, {
    method: "POST",
  });
}

export function listAdminSecurityEvents() {
  return request<
    {
      id: string;
      type: string;
      result: string;
      actor_type: string;
      occurred_at: string;
    }[]
  >("/iam/admin/security-events?page=1&pageSize=50", { method: "GET" });
}

export async function signOut() {
  await requestVoid("/iam/signout", {
    method: "POST",
  });
}

export async function getCurrentUser() {
  try {
    return await request<CurrentUser>("/iam/me", {
      method: "GET",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
    ) {
      return null;
    }
    throw error;
  }
}

export function listNotifications(page = 1, pageSize = 25) {
  return request<NotificationItem[]>(
    `/notifications?page=${page}&pageSize=${pageSize}`,
    { method: "GET" },
  );
}

export function getUnreadNotificationCount() {
  return request<{ count: number }>("/notifications/unread-count", {
    method: "GET",
  });
}

export function markNotificationRead(notificationId: string) {
  return requestVoid(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );
}

export function markAllNotificationsRead() {
  return requestVoid("/notifications/read-all", { method: "POST" });
}

export function getNotificationPreferences() {
  return request<NotificationPreference[]>("/notifications/preferences", {
    method: "GET",
  });
}

export function updateNotificationPreference(
  channel: NotificationPreference["channel"],
  enabled: boolean,
) {
  return requestVoid(`/notifications/preferences/${channel}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export async function changeEmail(payload: ChangeEmailPayload) {
  await requestVoid("/iam/me/email", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: ChangePasswordPayload) {
  await requestVoid("/iam/me/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string) {
  await requestVoid(`/iam/verify?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });
}

export async function resendEmailVerification(): Promise<void> {
  await requestVoid("/iam/verify/resend", {
    method: "POST",
  });
}

export function listCurrentUserSessions(): Promise<CurrentUserSession[]> {
  return request<CurrentUserSession[]>("/iam/me/sessions", {
    method: "GET",
  });
}

export async function revokeCurrentUserSession(
  sessionId: string,
): Promise<void> {
  await requestVoid(`/iam/me/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function assignUserRole(
  userId: string,
  role: "user" | "admin",
): Promise<void> {
  await requestVoid(`/iam/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function suspendUser(userId: string): Promise<void> {
  await requestVoid(`/iam/users/${userId}/suspend`, {
    method: "PATCH",
  });
}

export async function activateUser(userId: string): Promise<void> {
  await requestVoid(`/iam/users/${userId}/activate`, {
    method: "PATCH",
  });
}

export async function listUsers(
  criteria: ListUsersCriteria,
): Promise<ListUsersResult> {
  const parameters = new URLSearchParams({
    page: String(criteria.page),
    pageSize: String(criteria.pageSize),
  });
  if (criteria.search?.trim()) {
    parameters.set("search", criteria.search.trim());
  }
  if (criteria.role !== undefined) {
    parameters.set("role", criteria.role);
  }
  if (criteria.status !== undefined) {
    parameters.set("status", criteria.status);
  }
  if (criteria.emailVerified !== undefined) {
    parameters.set("emailVerified", String(criteria.emailVerified));
  }

  const response = await requestEnvelope<
    AdminUser[],
    { pagination: UserListPagination }
  >(`/iam/users?${parameters.toString()}`, { method: "GET" });
  if (response === null || response.meta === undefined) {
    throw new Error("INVALID_RESPONSE");
  }

  return {
    users: response.data,
    pagination: response.meta.pagination,
  };
}

export function getUserAdministrationOverview(): Promise<UserAdministrationOverview> {
  return request<UserAdministrationOverview>("/iam/users/overview", {
    method: "GET",
  });
}

export function listUserSessions(
  userId: string,
): Promise<AdministeredUserSession[]> {
  return request<AdministeredUserSession[]>(`/iam/users/${userId}/sessions`, {
    method: "GET",
  });
}

export async function revokeUserSession(
  userId: string,
  sessionId?: string,
): Promise<void> {
  const suffix = sessionId ? `/${sessionId}` : "";
  await requestVoid(`/iam/users/${userId}/sessions${suffix}`, {
    method: "DELETE",
  });
}
