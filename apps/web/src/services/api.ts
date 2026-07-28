// @file apps/web/src/services/api.ts

export interface CurrentUser {
  userId: string;
  email: string;
  isEmailVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isActive: boolean;
  isCurrent: boolean;
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
      approximate: true;
    } | null;
  };
}

export interface AdminUser {
  userId: string;
  email: string;
  isEmailVerified: boolean;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export type AdminSession = UserSession;

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

interface ApiResponse<T> {
  data: T;
}

interface ApiError {
  error: {
    code: string;
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
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
    return null as unknown as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T> | ApiError)
    : null;

  if (!response.ok) {
    const apiError = body as ApiError | null;
    throw new Error(apiError?.error?.code ?? `HTTP_${response.status}`);
  }

  return (body as ApiResponse<T> | null)?.data as T;
}

export async function signUp(payload: SignUpPayload) {
  return request<{ userId: string }>("/identity/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPasswordPolicy(): Promise<PasswordPolicy> {
  return request<PasswordPolicy>("/identity/password-policy", {
    method: "GET",
  });
}

export function evaluatePassword(
  password: string,
): Promise<PasswordEvaluation> {
  return request<PasswordEvaluation>("/identity/password-policy/evaluate", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function signIn(payload: SignInPayload) {
  return request<{ userId: string }>("/identity/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function signOut() {
  await request<unknown>("/identity/signout", {
    method: "POST",
  });
}

export async function getCurrentUser() {
  try {
    return await request<CurrentUser>("/identity/me", {
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
  await request<unknown>("/identity/me/email", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: ChangePasswordPayload) {
  await request<unknown>("/identity/me/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string) {
  await request<unknown>(
    `/identity/verify?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
    },
  );
}

export async function resendEmailVerification(): Promise<void> {
  await request<unknown>("/identity/verify/resend", {
    method: "POST",
  });
}

export function listCurrentUserSessions(): Promise<UserSession[]> {
  return request<UserSession[]>("/identity/me/sessions", {
    method: "GET",
  });
}

export async function revokeCurrentUserSession(
  sessionId: string,
): Promise<void> {
  await request<unknown>(`/identity/me/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function assignUserRole(
  userId: string,
  role: "user" | "admin",
): Promise<void> {
  await request<unknown>(`/identity/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function suspendUser(userId: string): Promise<void> {
  await request<unknown>(`/identity/users/${userId}/suspend`, {
    method: "PATCH",
  });
}

export async function activateUser(userId: string): Promise<void> {
  await request<unknown>(`/identity/users/${userId}/activate`, {
    method: "PATCH",
  });
}

export function listUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>("/identity/users", { method: "GET" });
}

export function listUserSessions(userId: string): Promise<AdminSession[]> {
  return request<AdminSession[]>(`/identity/users/${userId}/sessions`, {
    method: "GET",
  });
}

export async function revokeUserSession(
  userId: string,
  sessionId?: string,
): Promise<void> {
  const suffix = sessionId ? `/${sessionId}` : "";
  await request<unknown>(`/identity/users/${userId}/sessions${suffix}`, {
    method: "DELETE",
  });
}
