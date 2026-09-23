"use client";

import type { AuthResponse, PublicUser } from "@lifeos/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * MVP token handling: access token in memory, refresh token in localStorage so
 * it survives reloads. NOTE (security, to harden later): a refresh token in
 * localStorage is reachable by any XSS on the page. Production should move it to
 * an httpOnly, SameSite cookie set by the API. Logged in 04_LEARNING_LOG.md.
 */
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

const REFRESH_KEY = "lifeos.refreshToken";

function setRefresh(token: string) {
  localStorage.setItem(REFRESH_KEY, token);
}
function getRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
function clearRefresh() {
  localStorage.removeItem(REFRESH_KEY);
}

function store(res: AuthResponse) {
  accessToken = res.accessToken;
  setRefresh(res.refreshToken);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function register(email: string, password: string): Promise<void> {
  store(await post<AuthResponse>("/auth/register", { email, password }));
}

export async function login(email: string, password: string): Promise<void> {
  store(await post<AuthResponse>("/auth/login", { email, password }));
}

export async function logout(): Promise<void> {
  const refreshToken = getRefresh();
  if (refreshToken) await post<void>("/auth/logout", { refreshToken }).catch(() => {});
  accessToken = null;
  clearRefresh();
}

/** Exchange the stored refresh token for a fresh pair (rotation). */
function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefresh();
    if (!refreshToken) return false;
    try {
      store(await post<AuthResponse>("/auth/refresh", { refreshToken }));
      return true;
    } catch {
      clearRefresh();
      accessToken = null;
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** Fetch the current user, transparently refreshing once on a 401. */
export async function me(): Promise<PublicUser | null> {
  const call = async (): Promise<Response> =>
    fetch(`${API}/auth/me`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

  let res = await call();
  if (res.status === 401 && (await tryRefresh())) {
    res = await call();
  }
  if (!res.ok) return null;
  const data = (await res.json()) as { user: PublicUser | null };
  return data.user;
}
