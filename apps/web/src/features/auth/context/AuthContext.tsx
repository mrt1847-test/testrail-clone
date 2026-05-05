import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchMe, login as loginApi, logout as logoutApi } from "../api/authApi";
import { getAccessToken, setAccessToken } from "../../../shared/api/http";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  memberships: Array<{ projectId: string; role: string }>;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Array<{ projectId: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await fetchMe();
        setUser(me.user);
        setMemberships(me.memberships);
      } catch {
        setAccessToken(null);
        setUser(null);
        setMemberships([]);
      } finally {
        setLoading(false);
      }
    }
    void bootstrap();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      loading,
      login: async (email, password) => {
        const next = await loginApi(email, password);
        setUser(next);
        const me = await fetchMe();
        setMemberships(me.memberships);
      },
      logout: async () => {
        await logoutApi();
        setUser(null);
        setMemberships([]);
      }
    }),
    [user, memberships, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
