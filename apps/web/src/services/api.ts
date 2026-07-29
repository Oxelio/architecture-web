// @file apps/web/src/services/api.ts

export interface CurrentUser {
  userId: string;
  email: string;
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
  email: string;
  isEmailVerified: boolean;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
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
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface ChangeEmailPayload {
  email: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
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

export function evaluatePassword(
  password: string,
): Promise<PasswordEvaluation> {
  return request<PasswordEvaluation>("/iam/password-policy/evaluate", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function signIn(payload: SignInPayload) {
  await requestVoid("/iam/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
