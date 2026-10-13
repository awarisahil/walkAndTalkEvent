import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginApi, registerApi } from "../api/auth";
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  readStoredAuth,
} from "../api/client";
import { fetchMe } from "../api/users";
import { AuthContext } from "./authContext";
import type { RegisterPayload, User } from "../types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Only block rendering on bootstrap when a stored session must be validated.
  const [loading, setLoading] = useState(() => readStoredAuth() !== null);

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored) return;

    let cancelled = false;

    void (async () => {
      try {
        const freshUser = await fetchMe();
        if (cancelled) return;
        setToken(stored.token);
        setUserState(freshUser);
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ token: stored.token, user: freshUser }),
        );
      } catch {
        if (!cancelled) {
          clearStoredAuth();
          setToken(null);
          setUserState(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUserState(nextUser);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser }),
    );
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginApi(email, password);
      persist(data.accessToken, data.user);
      return data.user;
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await registerApi(payload);
      persist(data.accessToken, data.user);
      return data.user;
    },
    [persist],
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((nextUser: User) => {
    setUserState(nextUser);
    const stored = readStoredAuth();
    if (stored) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: stored.token, user: nextUser }),
      );
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, setUser }),
    [user, token, loading, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
