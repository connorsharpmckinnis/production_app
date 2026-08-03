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
import type { AppRole, ImpersonationInfo, UserResponse } from "@/lib/types";

interface AuthContextValue {
  user: UserResponse | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  actAs: (userId: number) => Promise<void>;
  stopActAs: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isDirector: boolean;
  isActorOnly: boolean;
  canManagePreparation: boolean;
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(async (username: string, password: string) => {
    const tokenResponse = await api.login({ username, password });
    setToken(tokenResponse.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const actAs = useCallback(async (userId: number) => {
    const tokenResponse = await api.actAs({ user_id: userId });
    setToken(tokenResponse.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const stopActAs = useCallback(async () => {
    const tokenResponse = await api.stopActAs();
    setToken(tokenResponse.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const hasRole = useCallback(
    (role: AppRole) => user?.roles.includes(role) ?? false,
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
      isDirector: hasRole("Director"),
      isActorOnly:
        hasRole("Actor") && !hasRole("Admin") && !hasRole("Director"),
      canManagePreparation: hasRole("Admin") || hasRole("Director"),
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
