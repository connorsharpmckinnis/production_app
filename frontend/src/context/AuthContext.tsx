import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, setToken } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { GlobalRole, ImpersonationInfo, UserResponse } from "@/lib/types";

function clearServerStateCache() {
  // Drop authenticated production-scoped GETs on identity change.
  queryClient.clear();
}

interface AuthContextValue {
  user: UserResponse | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  actAs: (userId: number) => Promise<void>;
  stopActAs: () => Promise<void>;
  hasRole: (role: GlobalRole) => boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
  impersonation: ImpersonationInfo | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await api.me();
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
      clearServerStateCache();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(async (username: string, password: string) => {
    clearServerStateCache();
    const tokenResponse = await api.login({ username, password });
    setToken(tokenResponse.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    clearServerStateCache();
  }, []);

  const actAs = useCallback(async (userId: number) => {
    clearServerStateCache();
    const tokenResponse = await api.actAs({ user_id: userId });
    setToken(tokenResponse.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const stopActAs = useCallback(async () => {
    clearServerStateCache();
    const tokenResponse = await api.stopActAs();
    setToken(tokenResponse.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const hasRole = useCallback(
    (role: GlobalRole) => user?.roles.includes(role) ?? false,
    [user],
  );

  const impersonation = user?.impersonation ?? null;
  const isImpersonating = impersonation != null;

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      actAs,
      stopActAs,
      hasRole,
      isAdmin: hasRole("Admin"),
      isImpersonating,
      impersonation,
    }),
    [
      user,
      loading,
      login,
      logout,
      actAs,
      stopActAs,
      hasRole,
      isImpersonating,
      impersonation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
