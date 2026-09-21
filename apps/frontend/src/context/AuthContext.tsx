import type { LoginResponse } from "@docysen/types";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { login as apiLogin, SESSION_STORAGE_KEY } from "../lib/api";

type AuthUser = LoginResponse["user"];

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isFirstLogin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** À appeler une fois le consentement email traité, pour ne plus afficher l'écran de bienvenue. */
  dismissFirstLogin: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function readSession(): { token: string; user: AuthUser } | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialisation paresseuse depuis sessionStorage plutôt qu'un useEffect + setState au montage,
  // qui déclencherait un rendu supplémentaire pour rien.
  const [token, setToken] = useState<string | null>(() => readSession()?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(() => readSession()?.user ?? null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    setToken(res.token);
    setUser(res.user);
    setIsFirstLogin(res.user.isFirstLogin);
    // Refresh token en sessionStorage (jamais localStorage).
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: res.token, user: res.user }),
    );
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setIsFirstLogin(false);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const dismissFirstLogin = useCallback(() => {
    setIsFirstLogin(false);
  }, []);

  const value = useMemo(
    () => ({ token, user, isFirstLogin, login, logout, dismissFirstLogin }),
    [token, user, isFirstLogin, login, logout, dismissFirstLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
