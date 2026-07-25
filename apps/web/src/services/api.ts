// @file apps/web/src/services/api.ts

export interface CurrentUser {
  userId: string;
  email: string;
  isEmailVerified: boolean;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload {
  email: string;
  password: string;
}

export interface ChangeEmailPayload {
  email: string;
}

export interface ChangePasswordPayload {
  password: string;
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

  if (init.body != null) {
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
