import type { LoginResponse } from "@docysen/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Erreur ${res.status}`, res.status);
  }
  return body as T;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then((res) => handle<LoginResponse>(res));
}

export function setNotificationEmail(
  token: string,
  choice: { optIn: true; email: string } | { optIn: false },
): Promise<{ notificationEmail: string | null }> {
  return fetch(`${API_BASE_URL}/users/me/notification-email`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(choice),
  }).then((res) => handle(res));
}
