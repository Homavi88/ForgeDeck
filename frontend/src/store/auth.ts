import { api, setToken } from "../api/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const KEY = "pf_user";

export function currentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser): void {
  setToken(token);
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function logout(): void {
  setToken("");
  localStorage.removeItem(KEY);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api.auth.login(email, password);
  storeSession(res.access_token, res.user);
  return res.user;
}

export async function register(email: string, name: string, password: string): Promise<AuthUser> {
  const res = await api.auth.register(email, name, password);
  storeSession(res.access_token, res.user);
  return res.user;
}
