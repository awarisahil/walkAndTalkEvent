import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginApi, logoutSession, registerApi } from "../api/auth";
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from "../api/client";
import { fetchMe } from "../api/users";
import { AuthContext } from "./authContext";
import type { RegisterPayload, User } from "../types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Only block rendering on bootstrap when a stored session must be validated.
  // Pre-refresh-token entries fail readStoredAuth's validation and read as
  // null here — the guards then send the user to log in once.
  const [loading, setLoading] = useState(() => readStoredAuth() !== null);

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored) return;

    let cancelled = false;

    void (async () => {
      try {
        const freshUser = await fetchMe();
        if (cancelled) return;
        setToken(stored.accessToken);
        setUserState(freshUser);
        writeStoredAuth({
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          user: freshUser,
        });
      } catch {
        // The 401 interceptor already attempted a transparent refresh and,
        // when that failed, cleared storage + redirected. If we land here
        // the session is truly dead — reset local state.
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

  const persist = useCallback(
    (accessToken: string, refreshToken: string, nextUser: User) => {
      setToken(accessToken);
      setUserState(nextUser);
      writeStoredAuth({ accessToken, refreshToken, user: nextUser });
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginApi(email, password);
      persist(data.accessToken, data.refreshToken, data.user);
      return data.user;
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await registerApi(payload);
      persist(data.accessToken, data.refreshToken, data.user);
      return data.user;
    },
    [persist],
  );

  const logout = useCallback(() => {
    const stored = readStoredAuth();
    if (stored) {
      // Revoke the refresh token server-side; ignore failures (expired or
      // already-dead tokens are fine — the local session ends regardless).
      logoutSession(stored.refreshToken).catch(() => undefined);
    }
    clearStoredAuth();
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((nextUser: User) => {
    setUserState(nextUser);
    const stored = readStoredAuth();
    if (stored) {
      writeStoredAuth({ ...stored, user: nextUser });
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, setUser }),
    [user, token, loading, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
